import { GscConnectionRepository } from "@/server/features/gsc/repositories/GscConnectionRepository";
import { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";
import {
  SearchConsoleService,
  type SearchConsoleOverview,
} from "@/server/features/search-console/SearchConsoleService";
import {
  GeoAuditService,
  type GeoAuditResult,
} from "@/server/features/geo/GeoAuditService";
import { GeoAuditRepository } from "@/server/features/geo/GeoAuditRepository";
import { buildWeeklyReport } from "@/server/features/weekly-reports/weeklyReportBuilder";
import {
  WeeklyReportRepository,
  type ActionStatus,
} from "@/server/features/weekly-reports/WeeklyReportRepository";
import {
  canSendReportEmail,
  sendReportEmail,
} from "@/server/features/weekly-reports/weeklyReportEmail";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";
import { AppError, describeError } from "@/server/lib/errors";
import { nextWeeklyRun } from "@/shared/weekly-schedule";

const REPORT_DAYS = 7;
// Each report reads Search Console, inspects URLs and fetches pages, so a
// tick generates only a few; the rest stay due for the next tick.
const REPORTS_PER_TICK = 1;

const DEFAULT_SETTINGS = {
  enabled: true,
  weekday: 1,
  time: "08:00",
  timezone: "Europe/Amsterdam",
  includeGsc: true,
  includeGeo: true,
  emailEnabled: false,
  dropAlertEnabled: false,
};

type WeeklyReportSettingsView = typeof DEFAULT_SETTINGS & {
  nextRunAt: string | null;
  recipients: string[];
  emailAvailable: boolean;
};

/** The schedule, created with defaults the first time it's read. */
async function getSettings(
  projectId: string,
): Promise<WeeklyReportSettingsView> {
  let row = await WeeklyReportRepository.getSettings(projectId);
  if (!row) {
    const nextRunAt = nextWeeklyRun({
      from: new Date(),
      weekday: DEFAULT_SETTINGS.weekday,
      time: DEFAULT_SETTINGS.time,
      timeZone: DEFAULT_SETTINGS.timezone,
    }).toISOString();
    await WeeklyReportRepository.upsertSettings({
      projectId,
      ...DEFAULT_SETTINGS,
      nextRunAt,
    });
    row = await WeeklyReportRepository.getSettings(projectId);
  }
  const [recipients, emailAvailable] = await Promise.all([
    WeeklyReportRepository.listRecipients(projectId),
    canSendReportEmail(),
  ]);
  return {
    enabled: row?.enabled ?? DEFAULT_SETTINGS.enabled,
    weekday: row?.weekday ?? DEFAULT_SETTINGS.weekday,
    time: row?.time ?? DEFAULT_SETTINGS.time,
    timezone: row?.timezone ?? DEFAULT_SETTINGS.timezone,
    includeGsc: row?.includeGsc ?? DEFAULT_SETTINGS.includeGsc,
    includeGeo: row?.includeGeo ?? DEFAULT_SETTINGS.includeGeo,
    emailEnabled: row?.emailEnabled ?? DEFAULT_SETTINGS.emailEnabled,
    dropAlertEnabled: row?.dropAlertEnabled ?? false,
    nextRunAt: row?.nextRunAt ?? null,
    recipients,
    emailAvailable,
  };
}

async function updateSettings(input: {
  projectId: string;
  enabled: boolean;
  weekday: number;
  time: string;
  timezone: string;
  includeGsc: boolean;
  includeGeo: boolean;
  emailEnabled: boolean;
  recipients: string[];
}) {
  const { recipients, ...settings } = input;
  const nextRunAt = settings.enabled
    ? nextWeeklyRun({
        from: new Date(),
        weekday: settings.weekday,
        time: settings.time,
        timeZone: settings.timezone,
      }).toISOString()
    : null;
  await WeeklyReportRepository.upsertSettings({
    ...settings,
    dropAlertEnabled: false,
    nextRunAt,
  });
  await WeeklyReportRepository.replaceRecipients(
    input.projectId,
    [...new Set(recipients.map((email) => email.trim().toLowerCase()))].filter(
      Boolean,
    ),
  );
  return getSettings(input.projectId);
}

async function loadGsc(projectId: string): Promise<{
  overview: SearchConsoleOverview | null;
  indexIssues: Array<{ url: string; kind: string; detail: string }> | null;
}> {
  if (!(await GscConnectionRepository.getByProjectId(projectId))) {
    return { overview: null, indexIssues: null };
  }
  const [overview, indexing] = await Promise.all([
    SearchConsoleService.getOverview({ projectId, days: REPORT_DAYS }),
    SearchConsoleService.getIndexing({ projectId, days: 28 }).catch(
      (error: unknown) => {
        console.warn(
          "[weekly-report] indexing check failed",
          describeError(error),
        );
        return null;
      },
    ),
  ]);
  return { overview, indexIssues: indexing?.issues ?? null };
}

/** Builds and stores one report now, and emails it when that's switched on. */
async function generate(input: {
  projectId: string;
  trigger: "manual" | "scheduled";
}) {
  const project = await ProjectRepository.getProjectById(input.projectId);
  if (!project) throw new AppError("NOT_FOUND", "Store not found.");
  const settings = await getSettings(input.projectId);
  const previousAudit = await GeoAuditRepository.getLatest(input.projectId);

  const [gsc, geo] = await Promise.all([
    settings.includeGsc
      ? loadGsc(input.projectId)
      : { overview: null, indexIssues: null },
    settings.includeGeo && project.domain
      ? GeoAuditService.run({
          projectId: input.projectId,
          trigger: input.trigger,
        })
          .then((audit): (GeoAuditResult & { id: string }) | null => audit)
          .catch((error: unknown) => {
            console.warn(
              "[weekly-report] GEO audit failed",
              describeError(error),
            );
            return null;
          })
      : null,
  ]);

  const built = buildWeeklyReport({
    gsc: gsc.overview,
    indexIssues: gsc.indexIssues,
    geo,
    previousGeoScore: previousAudit?.score ?? null,
  });
  const periods = gsc.overview?.periods.current;
  const today = new Date().toISOString().slice(0, 10);
  const report = await WeeklyReportRepository.insertReport({
    projectId: input.projectId,
    periodStart:
      periods?.startDate ??
      new Date(Date.now() - (REPORT_DAYS - 1) * 86_400_000)
        .toISOString()
        .slice(0, 10),
    periodEnd: periods?.endDate ?? today,
    clicks: built.clicks,
    previousClicks: built.previousClicks,
    geoAuditId: geo?.id ?? null,
    geoScore: built.geoScore,
    previousGeoScore: previousAudit?.score ?? null,
    opportunities: built.opportunities,
    indexIssues: built.indexIssues,
    summary: built.summary,
    actions: built.actions,
  });

  if (settings.emailEnabled && settings.recipients.length > 0) {
    try {
      const baseUrl = await getOptionalEnvValue("BETTER_AUTH_URL");
      const sent = await sendReportEmail({
        to: settings.recipients,
        storeName: project.domain ?? project.name,
        periodLabel: `${periods?.startDate ?? ""} – ${periods?.endDate ?? today}`,
        summary: built.summary,
        actions: built.actions,
        reportUrl: baseUrl
          ? `${baseUrl.replace(/\/$/, "")}/p/${input.projectId}/weekly-reports?report=${report.id}`
          : null,
      });
      if (sent) await WeeklyReportRepository.markEmailed(report.id);
    } catch (error) {
      console.error("[weekly-report] email failed", describeError(error));
    }
  }
  return report;
}

async function list(projectId: string) {
  const reports = await WeeklyReportRepository.listReports(projectId, 26);
  const actions = await WeeklyReportRepository.listActions(
    reports.map((report) => report.id),
  );
  return reports.map((report) => ({
    ...report,
    actions: actions.filter((action) => action.reportId === report.id),
  }));
}

async function setActionStatus(input: {
  projectId: string;
  actionId: string;
  status: ActionStatus;
}) {
  const updated = await WeeklyReportRepository.setActionStatus(input);
  if (!updated) throw new AppError("NOT_FOUND", "Action not found.");
}

/** Cron body: generate the reports that are due, a few per tick. */
export async function runScheduledWeeklyReports() {
  const now = new Date();
  const due = await WeeklyReportRepository.listDue(
    now.toISOString(),
    REPORTS_PER_TICK,
  );
  for (const entry of due) {
    const settings = await WeeklyReportRepository.getSettings(entry.projectId);
    if (!settings?.nextRunAt) continue;
    const claimed = await WeeklyReportRepository.claim({
      projectId: entry.projectId,
      dueAt: settings.nextRunAt,
      nextRunAt: nextWeeklyRun({
        from: now,
        weekday: settings.weekday,
        time: settings.time,
        timeZone: settings.timezone,
      }).toISOString(),
    });
    if (!claimed) continue;
    try {
      await generate({ projectId: entry.projectId, trigger: "scheduled" });
    } catch (error) {
      console.error(
        "[weekly-report] scheduled run failed",
        entry.projectId,
        describeError(error),
      );
    }
  }
}

export const WeeklyReportService = {
  getSettings,
  updateSettings,
  generate,
  list,
  setActionStatus,
};
