import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import { Skeleton } from "@/client/components/ui/skeleton";
import { ErrorState } from "@/client/components/ErrorState";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { useMarketCountry } from "@/client/features/markets/activeMarket";
import {
  ConnectSearchConsole,
  searchConsoleOverviewQuery,
  useProject,
} from "@/client/features/seo-app/hooks";
import {
  PageFrame,
  PageTitle,
  SegmentedTabs,
} from "@/client/features/seo-app/ui";
import { getSearchConsoleIndexing } from "@/serverFunctions/searchConsole";
import {
  SEARCH_CONSOLE_TAB_LABELS,
  SEARCH_CONSOLE_TABS,
  type SearchConsoleTab,
} from "@/shared/search-console";
import type { ComparedRow } from "@/server/features/search-console/searchConsoleData";
import {
  CannibalizationDetail,
  IndexingTable,
  MetricsTable,
} from "@/client/features/search-console/SearchConsoleTables";

type Search = {
  tab?: SearchConsoleTab;
  q?: string;
};

const PAGE_SIZE = 50;

const INTROS: Record<SearchConsoleTab, string> = {
  queries: "Every search your site appeared for, most clicks first.",
  pages: "Performance per URL.",
  opportunities:
    "Position 11–20 with real impressions: a better title or more content can move these onto page one.",
  decliners:
    "Queries that lost more than 20% of their clicks against the previous period.",
  cannibalization:
    "Queries where two or more of your own pages compete for the same search.",
  indexing:
    "Your most-shown pages that Google didn't index, or where Google chose a different canonical.",
};

function escapeCsv(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows: ComparedRow[], firstColumn: string) {
  const header = [
    firstColumn,
    "clicks",
    "impressions",
    "ctr",
    "position",
    "clicks_change",
  ];
  return [
    header.join(","),
    ...rows.map((row) =>
      [
        row.key,
        row.clicks,
        row.impressions,
        row.ctr.toFixed(4),
        row.position.toFixed(2),
        row.clicksChange === null ? "" : row.clicksChange.toFixed(4),
      ]
        .map(escapeCsv)
        .join(","),
    ),
  ].join("\n");
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function SearchConsolePage({
  projectId,
  search,
}: {
  projectId: string;
  search: Search;
}) {
  const navigate = useNavigate({ from: "/p/$projectId/search-console" });
  const project = useProject(projectId);
  const tab = search.tab ?? "queries";
  const { country, label: marketName } = useMarketCountry(projectId);
  const [filter, setFilter] = useState(search.q ?? "");
  const [shown, setShown] = useState(PAGE_SIZE);
  const overview = useQuery(
    searchConsoleOverviewQuery({
      projectId,
      days: 28,
      country,
    }),
  );
  const indexing = useQuery({
    queryKey: ["search-console-indexing", projectId],
    queryFn: () => getSearchConsoleIndexing({ data: { projectId, days: 28 } }),
    enabled: tab === "indexing",
    staleTime: 60 * 60_000,
    retry: false,
  });
  const data = overview.data?.connected ? overview.data : null;

  const setSearch = (next: Partial<Search>) => {
    setShown(PAGE_SIZE);
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });
  };

  const rows = useMemo(() => {
    if (!data) return [];
    const list: ComparedRow[] =
      tab === "pages"
        ? data.pages
        : tab === "opportunities"
          ? data.opportunities
          : tab === "decliners"
            ? data.decliners
            : tab === "cannibalization"
              ? data.cannibalization
              : data.queries;
    const needle = filter.trim().toLowerCase();
    return needle
      ? list.filter((row) => row.key.toLowerCase().includes(needle))
      : list;
  }, [data, tab, filter]);

  const counts: Record<SearchConsoleTab, number | undefined> = {
    queries: data?.queries.length,
    pages: data?.pages.length,
    opportunities: data?.opportunities.length,
    decliners: data?.decliners.length,
    cannibalization: data?.cannibalization.length,
    indexing: indexing.data?.connected
      ? indexing.data.issues.length
      : undefined,
  };

  return (
    <PageFrame wide>
      <PageTitle
        title="Search Console"
        domain={project?.domain}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm">
              In{" "}
              <strong className="font-medium text-foreground">
                {marketName}
              </strong>{" "}
              ·
            </span>
            <span className="text-sm">
              {data
                ? `${data.periods.current.startDate} – ${data.periods.current.endDate}, vs the 28 days before`
                : "Last 28 days vs the 28 days before"}
            </span>
          </span>
        }
        actions={
          <>
            <label className="flex min-h-10 min-w-[240px] items-center rounded-lg border border-input bg-card px-3">
              <span className="sr-only">Filter the table</span>
              <input
                data-slot="native-input"
                type="search"
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value);
                  setShown(PAGE_SIZE);
                }}
                placeholder="Filter by query or URL"
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
            <Button
              variant="outline"
              disabled={!data || tab === "indexing"}
              onClick={() =>
                download(
                  `search-console-${tab}.csv`,
                  toCsv(rows, tab === "pages" ? "page" : "query"),
                )
              }
            >
              <Download />
              Export CSV
            </Button>
          </>
        }
      />

      {overview.isPending ? (
        <Skeleton className="h-[480px] w-full rounded-xl" />
      ) : overview.isError ? (
        <ErrorState
          message={getStandardErrorMessage(
            overview.error,
            "Couldn't load Search Console data.",
          )}
          onRetry={() => void overview.refetch()}
          isRetrying={overview.isFetching}
        />
      ) : !data ? (
        <ConnectSearchConsole projectId={projectId} />
      ) : (
        <>
          <SegmentedTabs
            label="View"
            value={tab}
            onChange={(value) => setSearch({ tab: value })}
            tabs={SEARCH_CONSOLE_TABS.map((value) => ({
              value,
              label: SEARCH_CONSOLE_TAB_LABELS[value],
              count: counts[value],
              alert: value === "decliners" || value === "indexing",
            }))}
          />
          <p className="m-0 text-sm text-muted-foreground">{INTROS[tab]}</p>
          {tab === "indexing" ? (
            <IndexingTable
              loading={indexing.isPending}
              error={indexing.error}
              data={indexing.data}
              onRetry={() => void indexing.refetch()}
            />
          ) : (
            <MetricsTable
              tab={tab}
              rows={rows}
              shown={shown}
              onShowMore={() => setShown((value) => value + PAGE_SIZE)}
              syncedAt={overview.dataUpdatedAt}
            />
          )}
          {tab === "cannibalization" ? (
            <CannibalizationDetail rows={data.cannibalization.slice(0, 3)} />
          ) : null}
        </>
      )}
    </PageFrame>
  );
}
