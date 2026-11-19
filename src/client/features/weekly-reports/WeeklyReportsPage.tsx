import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/client/components/ui/button";
import { Skeleton } from "@/client/components/ui/skeleton";
import { ErrorState } from "@/client/components/ErrorState";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { useProject } from "@/client/features/seo-app/hooks";
import {
  ChangePill,
  PageFrame,
  PageTitle,
  Panel,
  relativeChange,
} from "@/client/features/seo-app/ui";
import {
  generateWeeklyReport,
  getWeeklyReportSettings,
} from "@/serverFunctions/weeklyReports";
import { WEEKDAY_NAMES } from "@/shared/weekly-schedule";
import {
  formatReportDate,
  weekLabel,
  weeklyReportsQuery,
} from "@/client/features/weekly-reports/weeklyReportQueries";
import { ReportArticle } from "@/client/features/weekly-reports/ReportArticle";

export function WeeklyReportsPage({
  projectId,
  reportId,
}: {
  projectId: string;
  reportId?: string;
}) {
  const navigate = useNavigate({ from: "/p/$projectId/weekly-reports" });
  const project = useProject(projectId);
  const queryClient = useQueryClient();
  const reports = useQuery(weeklyReportsQuery(projectId));
  const settings = useQuery({
    queryKey: ["weekly-report-settings", projectId],
    queryFn: () => getWeeklyReportSettings({ data: { projectId } }),
  });
  const generate = useMutation({
    mutationFn: () => generateWeeklyReport({ data: { projectId } }),
    onSuccess: async (report) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["weekly-reports", projectId],
        }),
        queryClient.invalidateQueries({ queryKey: ["geo-audit", projectId] }),
      ]);
      void navigate({ search: { report: report.id } });
      toast.success("Weekly report ready");
    },
    onError: (error) =>
      toast.error(getStandardErrorMessage(error, "The report failed.")),
  });
  const list = reports.data ?? [];
  const current = list.find((report) => report.id === reportId) ?? list[0];
  const schedule = settings.data;

  return (
    <PageFrame wide>
      <PageTitle
        title="Weekly reports"
        domain={project?.domain}
        subtitle={
          schedule
            ? schedule.enabled
              ? `Every ${WEEKDAY_NAMES[schedule.weekday]} at ${schedule.time}`
              : "The weekly schedule is off"
            : " "
        }
        actions={
          <>
            <Link
              to="/p/$projectId/settings/weekly-report"
              params={{ projectId }}
              className="text-sm font-medium text-link hover:text-link-hover"
            >
              Change schedule
            </Link>
            <Button
              onClick={() => generate.mutate()}
              pending={generate.isPending}
              disabled={generate.isPending}
            >
              <FileText />
              {generate.isPending ? "Building report…" : "Build report now"}
            </Button>
          </>
        }
      />
      {reports.isPending ? (
        <Skeleton className="h-[480px] w-full rounded-xl" />
      ) : reports.isError ? (
        <ErrorState
          message={getStandardErrorMessage(reports.error)}
          onRetry={() => void reports.refetch()}
        />
      ) : !current ? (
        <Panel title="No reports yet">
          <p className="m-0 max-w-prose text-sm leading-relaxed text-muted-foreground">
            The first report arrives at the next scheduled run. Build one now to
            see this week's Search Console changes, a fresh GEO audit and the
            actions that matter most.
          </p>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <section
            aria-label="Reports"
            className="flex flex-col gap-1 rounded-xl border border-border bg-secondary p-1.5"
          >
            {list.map((report) => {
              const selected = report.id === current.id;
              const change =
                report.clicks !== null && report.previousClicks !== null
                  ? relativeChange(report.clicks, report.previousClicks)
                  : null;
              return (
                <button
                  key={report.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    void navigate({ search: { report: report.id } })
                  }
                  className={cn(
                    "flex min-h-14 items-center gap-2.5 rounded-lg border px-3 py-2 text-left",
                    selected
                      ? "border-border bg-card shadow-xs"
                      : "border-transparent hover:bg-card/60",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-[7px] shrink-0 rounded-full",
                      selected ? "bg-primary" : "bg-transparent",
                    )}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium">
                      {formatReportDate(report.createdAt)}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {weekLabel(report)}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    {report.geoScore !== null ? (
                      <span className="text-xs text-muted-foreground">
                        GEO {report.geoScore}
                      </span>
                    ) : null}
                    <ChangePill change={change} />
                  </span>
                </button>
              );
            })}
          </section>
          <ReportArticle
            projectId={projectId}
            report={current}
            recipients={schedule?.emailEnabled ? schedule.recipients : []}
          />
        </div>
      )}
    </PageFrame>
  );
}
