import { RefreshCw } from "lucide-react";
import { Skeleton } from "@/client/components/ui/skeleton";
import { ErrorState } from "@/client/components/ErrorState";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  ChangePill,
  formatNumber,
  formatPercent,
  formatPosition,
  pathOf,
  Pill,
} from "@/client/features/seo-app/ui";
import type { getSearchConsoleIndexing } from "@/serverFunctions/searchConsole";
import type { SearchConsoleTab } from "@/shared/search-console";
import type { SearchConsoleOverview } from "@/server/features/search-console/SearchConsoleService";
import type { ComparedRow } from "@/server/features/search-console/searchConsoleData";

function noteFor(
  tab: SearchConsoleTab,
  row: ComparedRow,
): string | null {
  if (tab === "decliners" && row.previousPosition !== null) {
    return `Position ${formatPosition(row.previousPosition)} → ${row.position ? formatPosition(row.position) : "gone"}`;
  }
  if (tab === "cannibalization" && "pages" in row) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- narrowed by the `in` check
    return `${(row as SearchConsoleOverview["cannibalization"][number]).pages.length} pages compete`;
  }
  return null;
}

export function MetricsTable({
  tab,
  rows,
  shown,
  onShowMore,
  syncedAt,
}: {
  tab: SearchConsoleTab;
  rows: ComparedRow[];
  shown: number;
  onShowMore: () => void;
  syncedAt: number;
}) {
  const first = tab === "pages" ? "Page" : "Query";
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[13px] text-muted-foreground">
              <th scope="col" className="px-5 py-3.5 font-medium">
                {first}
              </th>
              <th scope="col" className="px-3 py-3.5 text-right font-medium">
                Clicks
              </th>
              <th scope="col" className="px-3 py-3.5 text-right font-medium">
                Impressions
              </th>
              <th scope="col" className="px-3 py-3.5 text-right font-medium">
                CTR
              </th>
              <th scope="col" className="px-3 py-3.5 text-right font-medium">
                Position
              </th>
              <th scope="col" className="px-5 py-3.5 text-right font-medium">
                Δ clicks
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-10 text-center text-muted-foreground"
                >
                  Nothing here for this period.
                </td>
              </tr>
            ) : (
              rows.slice(0, shown).map((row) => {
                const note = noteFor(tab, row);
                return (
                  <tr key={row.key} className="border-t border-background">
                    <td className="max-w-[420px] px-5 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="truncate font-medium" title={row.key}>
                          {tab === "pages" ? pathOf(row.key) : row.key}
                        </span>
                        {note ? (
                          <span className="text-xs text-muted-foreground">
                            {note}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatNumber(row.clicks)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatNumber(row.impressions)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatPercent(row.ctr)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatPosition(row.position)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <ChangePill change={row.clicksChange} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted px-5 py-3 text-[13px] text-muted-foreground">
        <span>
          {rows.length === 0
            ? "0 rows"
            : `1–${Math.min(shown, rows.length).toLocaleString("en-US")} of ${rows.length.toLocaleString("en-US")}`}
          {rows.length > shown ? (
            <button
              type="button"
              onClick={onShowMore}
              className="ml-3 font-medium text-link hover:text-link-hover"
            >
              Show more
            </button>
          ) : null}
        </span>
        <span>
          Source: Search Console API · loaded{" "}
          {new Date(syncedAt).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </section>
  );
}

export function CannibalizationDetail({
  rows,
}: {
  rows: SearchConsoleOverview["cannibalization"];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rows.map((row) => (
        <section
          key={row.key}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5"
        >
          <h2 className="m-0 text-[15px] font-semibold">
            "{row.key}" · competing pages
          </h2>
          {row.pages.map((page) => (
            <div
              key={page.page}
              className="flex flex-col gap-0.5 border-t border-background pt-2.5"
            >
              <span className="truncate text-sm font-medium" title={page.page}>
                {pathOf(page.page)}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatNumber(page.clicks)} clicks · position{" "}
                {formatPosition(page.position)} ·{" "}
                {Math.round(page.impressionShare * 100)}% of impressions
              </span>
            </div>
          ))}
          <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
            Pick the page that answers this search best, make it the main page,
            and link to it from the others with this query as the anchor text.
          </p>
        </section>
      ))}
    </div>
  );
}

export function IndexingTable({
  loading,
  error,
  data,
  onRetry,
}: {
  loading: boolean;
  error: unknown;
  data: Awaited<ReturnType<typeof getSearchConsoleIndexing>> | undefined;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-64 w-full rounded-xl" />
        <p className="m-0 text-xs text-muted-foreground">
          Inspecting your top pages with Google. This takes up to a minute.
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <ErrorState
        message={getStandardErrorMessage(error, "The URL inspection failed.")}
        onRetry={onRetry}
      />
    );
  }
  if (!data?.connected) return null;
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[13px] text-muted-foreground">
              <th scope="col" className="px-5 py-3.5 font-medium">
                Page
              </th>
              <th scope="col" className="px-5 py-3.5 text-right font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {data.issues.length === 0 ? (
              <tr>
                <td
                  colSpan={2}
                  className="px-5 py-10 text-center text-muted-foreground"
                >
                  All {data.inspected} inspected pages are indexed with the
                  canonical you chose.
                </td>
              </tr>
            ) : (
              data.issues.map((issue) => (
                <tr key={issue.url} className="border-t border-background">
                  <td className="max-w-[560px] px-5 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="truncate font-medium" title={issue.url}>
                        {pathOf(issue.url)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {issue.detail}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Pill
                      tone={
                        issue.kind === "canonical"
                          ? "warn"
                          : issue.kind === "error"
                            ? "neutral"
                            : "down"
                      }
                    >
                      {issue.kind === "canonical"
                        ? "Canonical differs"
                        : issue.kind === "error"
                          ? "Not inspected"
                          : "Not indexed"}
                    </Pill>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border bg-muted px-5 py-3 text-[13px] text-muted-foreground">
        <span>
          {data.issues.length} issues · {data.inspected} top pages inspected
        </span>
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 font-medium text-link hover:text-link-hover"
        >
          <RefreshCw className="size-3.5" />
          Inspect again
        </button>
      </div>
    </section>
  );
}
