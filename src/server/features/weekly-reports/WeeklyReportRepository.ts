import { and, asc, desc, eq, inArray, isNotNull, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  projectNotes,
  projects,
  weeklyReportActions,
  weeklyReportRecipients,
  weeklyReportSettings,
  weeklyReports,
} from "@/db/schema";
import type { ReportAction } from "@/server/features/weekly-reports/weeklyReportBuilder";

type SettingsRow = typeof weeklyReportSettings.$inferSelect;
export type ActionStatus = (typeof weeklyReportActions.$inferSelect)["status"];

async function getSettings(projectId: string): Promise<SettingsRow | null> {
  const rows = await db
    .select()
    .from(weeklyReportSettings)
    .where(eq(weeklyReportSettings.projectId, projectId))
    .limit(1);
  return rows[0] ?? null;
}

async function upsertSettings(
  input: Omit<SettingsRow, "updatedAt">,
): Promise<void> {
  const { projectId, ...values } = input;
  const updatedAt = new Date().toISOString();
  await db
    .insert(weeklyReportSettings)
    .values({ projectId, ...values, updatedAt })
    .onConflictDoUpdate({
      target: weeklyReportSettings.projectId,
      set: { ...values, updatedAt },
    });
}

async function listRecipients(projectId: string) {
  const rows = await db
    .select({ email: weeklyReportRecipients.email })
    .from(weeklyReportRecipients)
    .where(eq(weeklyReportRecipients.projectId, projectId))
    .orderBy(asc(weeklyReportRecipients.email));
  return rows.map((row) => row.email);
}

async function replaceRecipients(projectId: string, emails: string[]) {
  await db
    .delete(weeklyReportRecipients)
    .where(eq(weeklyReportRecipients.projectId, projectId));
  if (emails.length === 0) return;
  await db
    .insert(weeklyReportRecipients)
    .values(
      emails.map((email) => ({ id: crypto.randomUUID(), projectId, email })),
    );
}

/** Enabled schedules that are due, on projects that still exist. */
async function listDue(nowIso: string, limit: number) {
  return db
    .select({
      projectId: weeklyReportSettings.projectId,
      organizationId: projects.organizationId,
    })
    .from(weeklyReportSettings)
    .innerJoin(projects, eq(projects.id, weeklyReportSettings.projectId))
    .where(
      and(
        eq(weeklyReportSettings.enabled, true),
        isNotNull(weeklyReportSettings.nextRunAt),
        lte(weeklyReportSettings.nextRunAt, nowIso),
      ),
    )
    .orderBy(asc(weeklyReportSettings.nextRunAt))
    .limit(limit);
}

/**
 * Moves a due schedule to its next run. Only one tick wins: the update
 * matches the run time that was read, so a second claim changes nothing.
 */
async function claim(input: {
  projectId: string;
  dueAt: string;
  nextRunAt: string;
}) {
  const rows = await db
    .update(weeklyReportSettings)
    .set({ nextRunAt: input.nextRunAt })
    .where(
      and(
        eq(weeklyReportSettings.projectId, input.projectId),
        eq(weeklyReportSettings.nextRunAt, input.dueAt),
      ),
    )
    .returning({ projectId: weeklyReportSettings.projectId });
  return rows.length > 0;
}

async function insertReport(input: {
  projectId: string;
  periodStart: string;
  periodEnd: string;
  clicks: number | null;
  previousClicks: number | null;
  geoAuditId: string | null;
  geoScore: number | null;
  previousGeoScore: number | null;
  opportunities: number | null;
  indexIssues: number | null;
  summary: string;
  actions: ReportAction[];
}) {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const { actions, ...report } = input;
  await db.insert(weeklyReports).values({ id, createdAt, ...report });
  if (actions.length > 0) {
    await db.insert(weeklyReportActions).values(
      actions.map((action, position) => ({
        id: crypto.randomUUID(),
        reportId: id,
        position,
        updatedAt: createdAt,
        ...action,
      })),
    );
  }
  return { id, createdAt };
}

async function markEmailed(reportId: string) {
  await db
    .update(weeklyReports)
    .set({ emailedAt: new Date().toISOString() })
    .where(eq(weeklyReports.id, reportId));
}

async function listReports(projectId: string, limit: number) {
  return db
    .select()
    .from(weeklyReports)
    .where(eq(weeklyReports.projectId, projectId))
    .orderBy(desc(weeklyReports.createdAt))
    .limit(limit);
}

async function getLatestReport(projectId: string) {
  const [row] = await listReports(projectId, 1);
  return row ?? null;
}

async function listActions(reportIds: string[]) {
  if (reportIds.length === 0) return [];
  return db
    .select()
    .from(weeklyReportActions)
    .where(inArray(weeklyReportActions.reportId, reportIds))
    .orderBy(asc(weeklyReportActions.position));
}

/** Scoped through the report, so one project can't touch another's action. */
async function setActionStatus(input: {
  projectId: string;
  actionId: string;
  status: ActionStatus;
}) {
  const owned = await db
    .select({ id: weeklyReportActions.id })
    .from(weeklyReportActions)
    .innerJoin(
      weeklyReports,
      eq(weeklyReports.id, weeklyReportActions.reportId),
    )
    .where(
      and(
        eq(weeklyReportActions.id, input.actionId),
        eq(weeklyReports.projectId, input.projectId),
      ),
    )
    .limit(1);
  if (owned.length === 0) return false;
  await db
    .update(weeklyReportActions)
    .set({ status: input.status, updatedAt: new Date().toISOString() })
    .where(eq(weeklyReportActions.id, input.actionId));
  return true;
}

async function listNotes(projectId: string, limit: number) {
  return db
    .select()
    .from(projectNotes)
    .where(eq(projectNotes.projectId, projectId))
    .orderBy(desc(projectNotes.noteDate), desc(projectNotes.createdAt))
    .limit(limit);
}

async function addNote(input: {
  projectId: string;
  noteDate: string;
  body: string;
}) {
  const id = crypto.randomUUID();
  await db.insert(projectNotes).values({
    id,
    createdAt: new Date().toISOString(),
    ...input,
  });
  return id;
}

async function deleteNote(projectId: string, noteId: string) {
  await db
    .delete(projectNotes)
    .where(
      and(eq(projectNotes.projectId, projectId), eq(projectNotes.id, noteId)),
    );
}

export const WeeklyReportRepository = {
  getSettings,
  upsertSettings,
  listRecipients,
  replaceRecipients,
  listDue,
  claim,
  insertReport,
  markEmailed,
  listReports,
  getLatestReport,
  listActions,
  setActionStatus,
  listNotes,
  addNote,
  deleteNote,
};
