import { sort } from "remeda";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { cn } from "cn";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Skeleton } from "@/client/components/ui/skeleton";
import {
  ChangePill,
  formatNumber,
  formatPercent,
  formatPosition,
  Panel,
  Pill,
  relativeChange,
  ScoreBar,
  ScoreRing,
} from "@/client/features/seo-app/ui";
import type { geoAuditQuery } from "@/client/features/geo/GeoPage";
import {
  formatReportDate,
  useActionStatus,
  weeklyReportsQuery,
} from "@/client/features/weekly-reports/weeklyReportQueries";
import type { SearchConsoleOverview } from "@/server/features/search-console/SearchConsoleService";

const MODULE_LINKS = {
  "search-console": {
    to: "/p/$projectId/search-console",
    label: "Search Console",
  },
  geo: { to: "/p/$projectId/geo", label: "GEO" },
  keywords: { to: "/p/$projectId/keywords", label: "Keywords" },
} as const;

export function OrganicPanel({
  gsc,
  countryLabel,
}: {
  gsc: SearchConsoleOverview;
  countryLabel: string;
}) {
  const kpis = [
    {
      label: "Clicks",
      value: formatNumber(gsc.totals.clicks),
      prev: formatNumber(gsc.previousTotals.clicks),
      change: relativeChange(gsc.totals.clicks, gsc.previousTotals.clicks),
      invert: false,
    },
    {
      label: "Impressions",
      value: formatNumber(gsc.totals.impressions),
      prev: formatNumber(gsc.previousTotals.impressions),
      change: relativeChange(
        gsc.totals.impressions,
        gsc.previousTotals.impressions,
      ),
      invert: false,
    },
    {
      label: "CTR",
      value: formatPercent(gsc.totals.ctr),
      prev: formatPercent(gsc.previousTotals.ctr),
      change: relativeChange(gsc.totals.ctr, gsc.previousTotals.ctr),
      invert: false,
    },
    {
      label: "Avg. position",
      value: formatPosition(gsc.totals.position),
      prev: formatPosition(gsc.previousTotals.position),
      change: relativeChange(gsc.totals.position, gsc.previousTotals.position),
      invert: true,
    },
  ];
  return (
    <Panel
      title={
        <span className="flex items-center gap-1.5">
          Organic performance · {countryLabel}
          <Info className="size-3.5 text-muted-foreground" aria-hidden />
        </span>
      }
      id="organic-h"
      bodyClassName="p-0"
      footer={
        <>
          <span>
            Queries with clicks:{" "}
            <strong className="font-semibold text-foreground">
              {formatNumber(gsc.queries.filter((row) => row.clicks > 0).length)}
            </strong>
          </span>
          <span>
            URLs:{" "}
            <strong className="font-semibold text-foreground">
              {formatNumber(gsc.pages.length)}
            </strong>
          </span>
          <span>
            Opportunities:{" "}
            <strong className="font-semibold text-foreground">
              {formatNumber(gsc.opportunities.length)}
            </strong>
          </span>
          <span>Source: Search Console</span>
        </>
      }
    >
      <div className="grid grid-cols-2 border-t border-border md:grid-cols-4">
        {kpis.map((kpi, index) => (
          <div
            key={kpi.label}
            className={cn(
              "flex flex-col gap-1.5 px-5 py-4",
              index > 0 && "md:border-l md:border-border",
              index % 2 === 1 && "border-l border-border md:border-l",
              index >= 2 && "border-t border-border md:border-t-0",
            )}
          >
            <span className="text-[13px] text-muted-foreground">
              {kpi.label}
            </span>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-[26px] font-semibold tracking-tight tabular-nums">
                {kpi.value}
              </span>
              <ChangePill change={kpi.change} invert={kpi.invert} />
            </div>
            <span className="text-xs text-muted-foreground">
              previous period: {kpi.prev}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function TodoPanel({ projectId }: { projectId: string }) {
  const reports = useQuery(weeklyReportsQuery(projectId));
  const setStatus = useActionStatus(projectId);
  const latest = reports.data?.[0];
  const done =
    latest?.actions.filter((action) => action.status === "done").length ?? 0;
  return (
    <Panel
      title="This week's to-dos"
      id="todo-h"
      aside={
        latest ? (
          <>
            <span className="text-xs text-muted-foreground">
              from the report of {formatReportDate(latest.createdAt)} · {done}{" "}
              of {latest.actions.length} done
            </span>
            <Link
              to="/p/$projectId/weekly-reports"
              params={{ projectId }}
              search={{ report: latest.id }}
              className="text-[13px] font-medium text-link hover:text-link-hover"
            >
              Full report
            </Link>
          </>
        ) : null
      }
    >
      {reports.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : !latest ? (
        <p className="m-0 text-sm text-muted-foreground">
          The first weekly report fills this list.{" "}
          <Link
            to="/p/$projectId/weekly-reports"
            params={{ projectId }}
            className="font-medium text-link hover:text-link-hover"
          >
            Build one now
          </Link>
          .
        </p>
      ) : latest.actions.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">
          Nothing urgent this week.
        </p>
      ) : (
        <div className="flex flex-col">
          {latest.actions.map((action) => {
            const module = MODULE_LINKS[action.module];
            const isDone = action.status === "done";
            return (
              <div
                key={action.id}
                className="flex items-start gap-3 border-t border-background py-3 first:border-t-0 first:pt-0"
              >
                <Checkbox
                  className="mt-0.5"
                  checked={isDone}
                  aria-label={action.title}
                  onCheckedChange={(checked) =>
                    setStatus.mutate({
                      actionId: action.id,
                      status: checked ? "done" : "open",
                    })
                  }
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isDone && "text-muted-foreground line-through",
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
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Pill
                    tone={
                      action.impact === "high"
                        ? "info"
                        : action.impact === "medium"
                          ? "neutral"
                          : "neutral"
                    }
                  >
                    {action.impact === "high"
                      ? "High impact"
                      : action.impact === "medium"
                        ? "Medium"
                        : "Low"}
                  </Pill>
                  <Link
                    to={module.to}
                    params={{ projectId }}
                    className="text-xs text-link hover:text-link-hover"
                  >
                    {module.label}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

export function SiteScorePanel({
  projectId,
  loading,
  data,
}: {
  projectId: string;
  loading: boolean;
  data:
    | Awaited<ReturnType<ReturnType<typeof geoAuditQuery>["queryFn"]>>
    | undefined;
}) {
  const audit = data?.audit ?? null;
  const history = data?.history ?? [];
  const previous = history.length > 1 ? history[history.length - 2] : null;
  const delta = audit && previous ? audit.score - previous.score : null;
  const citability = audit
    ? Math.round(
        audit.pages.reduce((sum, page) => sum + page.score, 0) /
          Math.max(audit.pages.length, 1),
      )
    : null;
  const weakest = audit
    ? sort(
        audit.categories.filter((category) => category.score !== null),
        (a, b) => (a.score ?? 0) - (b.score ?? 0),
      ).slice(0, 3)
    : [];
  const bands = ["Weak", "Moderate", "Fair", "Strong"] as const;
  return (
    <Panel
      title={
        <span className="flex items-center gap-1.5">
          Site score
          <Info className="size-3.5 text-muted-foreground" aria-hidden />
        </span>
      }
      id="geo-h"
      aside={
        <Link
          to="/p/$projectId/geo"
          params={{ projectId }}
          className="text-[13px] font-medium text-link hover:text-link-hover"
        >
          Details
        </Link>
      }
    >
      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : !audit ? (
        <p className="m-0 text-sm text-muted-foreground">
          No GEO audit yet. Run one to see how AI search reads the store.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <ScoreRing
              score={audit.score}
              label={`GEO score ${audit.score} of 100`}
            />
            <div className="flex flex-col gap-1">
              <span className="text-[13px] text-muted-foreground">
                GEO score
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-[32px] leading-none font-semibold tabular-nums">
                  {audit.score}
                </span>
                {delta ? (
                  <Pill tone={delta > 0 ? "up" : "down"}>
                    {delta > 0 ? "+" : ""}
                    {delta}
                  </Pill>
                ) : null}
              </div>
              <span className="text-xs text-muted-foreground">
                {audit.band}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-1" aria-hidden>
              {bands.map((band) => (
                <span
                  key={band}
                  className={cn(
                    "h-1.5 flex-1 rounded-full",
                    band === audit.band ? "bg-primary" : "bg-background",
                  )}
                />
              ))}
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              {bands.map((band) => (
                <span
                  key={band}
                  className={cn(
                    band === audit.band && "font-semibold text-foreground",
                  )}
                >
                  {band}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-background pt-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">
                Pages checked
              </span>
              <span className="text-lg font-semibold tabular-nums">
                {audit.pages.length}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">
                Avg. citability
              </span>
              <span className="text-lg font-semibold tabular-nums">
                {citability}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  / 100
                </span>
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-background pt-3">
            <span className="text-xs font-medium text-muted-foreground">
              Weakest categories
            </span>
            {weakest.map((category) => (
              <div
                key={category.key}
                className="flex items-center gap-2 text-sm"
              >
                <span className="w-28 shrink-0">{category.label}</span>
                <ScoreBar score={category.score ?? 0} />
                <span className="w-7 text-right font-semibold tabular-nums">
                  {category.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
