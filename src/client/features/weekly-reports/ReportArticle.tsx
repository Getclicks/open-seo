import { cn } from "cn";
import {
  ChangePill,
  formatNumber,
  Pill,
  relativeChange,
} from "@/client/features/seo-app/ui";
import {
  formatReportDate,
  STATUS_LABEL,
  STATUSES,
  useActionStatus,
  weekLabel,
  type Report,
} from "@/client/features/weekly-reports/weeklyReportQueries";

function Kpi({
  label,
  value,
  extra,
}: {
  label: string;
  value: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border p-4">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {extra}
      </div>
    </div>
  );
}

export function ReportArticle({
  projectId,
  report,
  recipients,
}: {
  projectId: string;
  report: Report;
  recipients: string[];
}) {
  const setStatus = useActionStatus(projectId);
  const clicksChange =
    report.clicks !== null && report.previousClicks !== null
      ? relativeChange(report.clicks, report.previousClicks)
      : null;
  const geoDelta =
    report.geoScore !== null && report.previousGeoScore !== null
      ? report.geoScore - report.previousGeoScore
      : null;
  return (
    <article
      aria-labelledby="report-title"
      className="flex flex-col gap-6 rounded-xl border border-border bg-card p-5 md:p-6"
    >
      <header className="flex flex-col gap-1">
        <span className="text-[13px] text-muted-foreground">
          {weekLabel(report)}
        </span>
        <h2 id="report-title" className="m-0 text-xl font-semibold">
          Weekly report {formatReportDate(report.createdAt)}
        </h2>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Clicks (7 days)"
          value={report.clicks === null ? "–" : formatNumber(report.clicks)}
          extra={<ChangePill change={clicksChange} />}
        />
        <Kpi
          label="GEO score"
          value={report.geoScore === null ? "–" : String(report.geoScore)}
          extra={
            geoDelta === null ? null : (
              <Pill tone={geoDelta >= 0 ? "up" : "down"}>
                {geoDelta >= 0 ? "+" : ""}
                {geoDelta}
              </Pill>
            )
          }
        />
        <Kpi
          label="Opportunities"
          value={
            report.opportunities === null ? "–" : String(report.opportunities)
          }
          extra={
            <span className="text-xs text-muted-foreground">pos. 11–20</span>
          }
        />
        <Kpi
          label="Index issues"
          value={report.indexIssues === null ? "–" : String(report.indexIssues)}
          extra={<span className="text-xs text-muted-foreground">open</span>}
        />
      </div>
      <section className="flex flex-col gap-2">
        <h3 className="m-0 text-[15px] font-semibold">Summary</h3>
        <p className="m-0 text-[15px] leading-relaxed">{report.summary}</p>
      </section>
      <section className="flex flex-col gap-1">
        <h3 className="m-0 mb-1 text-[15px] font-semibold">Actions</h3>
        {report.actions.length === 0 ? (
          <p className="m-0 text-sm text-muted-foreground">
            Nothing urgent this week.
          </p>
        ) : (
          report.actions.map((action, index) => (
            <div
              key={action.id}
              className="flex flex-wrap items-start gap-3 border-t border-background py-3"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                {index + 1}
              </span>
              <div className="flex min-w-[220px] flex-1 flex-col gap-0.5">
                <span
                  className={cn(
                    "text-sm font-medium",
                    action.status === "done" &&
                      "text-muted-foreground line-through",
                  )}
                >
                  {action.title}
                </span>
                {action.detail ? (
                  <span className="text-[13px] text-muted-foreground">
                    {action.detail}
                  </span>
                ) : null}
              </div>
              <label>
                <span className="sr-only">Status of {action.title}</span>
                <select
                  value={action.status}
                  onChange={(event) =>
                    setStatus.mutate({
                      actionId: action.id,
                      status:
                        STATUSES.find(
                          (status) => status === event.target.value,
                        ) ?? "open",
                    })
                  }
                  className={cn(
                    "min-h-8 rounded-full border px-2.5 text-xs font-medium",
                    action.status === "done"
                      ? "border-transparent bg-[#E3F6EA] text-[#17663A] dark:bg-success/20 dark:text-success"
                      : action.status === "in_progress"
                        ? "border-transparent bg-secondary text-foreground"
                        : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ))
        )}
      </section>
      <footer className="flex flex-wrap justify-between gap-2 border-t border-border pt-4 text-[13px] text-muted-foreground">
        <span>
          {report.emailedAt && recipients.length > 0 ? (
            <>
              Sent to:{" "}
              <strong className="font-medium text-foreground">
                {recipients.join(", ")}
              </strong>
            </>
          ) : (
            "Not emailed"
          )}
        </span>
        <span>Sources: Search Console · GEO audit</span>
      </footer>
    </article>
  );
}
