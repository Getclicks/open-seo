import { sort } from "remeda";
import { GscService } from "@/server/features/gsc/services/GscService";
import { resolveDateRange } from "@/server/features/gsc/searchAnalytics";
import { sumSearchTotals } from "@/server/features/gsc/searchPerformanceReport";
import type {
  GscDimension,
  GscPerformanceFilter,
} from "@/server/features/gsc/searchAnalytics";
import {
  compareRows,
  dailySeries,
  findCannibalization,
  findDecliners,
  findOpportunities,
} from "@/server/features/search-console/searchConsoleData";

const ROW_LIMIT = 5000;
// URL inspection answers in seconds per URL and has a daily quota, so only
// the pages that matter most are inspected.
const INSPECT_PAGE_LIMIT = 20;

function shiftDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The window of `days` ending at GSC's freshest day, and the one before. */
function comparisonPeriods(days: number, today: Date = new Date()) {
  const current = resolveDateRange({ dateRange: "last_7_days" }, today);
  const endDate = current.endDate;
  const startDate = shiftDays(endDate, -(days - 1));
  return {
    current: { startDate, endDate },
    previous: {
      startDate: shiftDays(startDate, -days),
      endDate: shiftDays(startDate, -1),
    },
  };
}

async function fetchRows(input: {
  projectId: string;
  dimensions: GscDimension[];
  startDate: string;
  endDate: string;
  filters: GscPerformanceFilter[];
}) {
  const result = await GscService.getPerformance({
    projectId: input.projectId,
    dimensions: input.dimensions,
    startDate: input.startDate,
    endDate: input.endDate,
    filters: input.filters,
    rowLimit: ROW_LIMIT,
  });
  return { siteUrl: result.siteUrl, rows: result.rows };
}

/**
 * Everything the Search Console screen and the dashboard show for one
 * period and the one before it: totals, daily trend, countries, queries,
 * pages and the derived opportunity, decliner and cannibalization lists.
 */
async function getOverview(input: {
  projectId: string;
  days: number;
  /** ISO alpha-3 country code, lower case; all countries when absent. */
  country?: string;
}) {
  const periods = comparisonPeriods(input.days);
  const filters: GscPerformanceFilter[] = input.country
    ? [{ dimension: "country", operator: "equals", expression: input.country }]
    : [];
  const both = (dimensions: GscDimension[], withFilters = filters) =>
    Promise.all([
      fetchRows({
        projectId: input.projectId,
        dimensions,
        ...periods.current,
        filters: withFilters,
      }),
      fetchRows({
        projectId: input.projectId,
        dimensions,
        ...periods.previous,
        filters: withFilters,
      }),
    ]);

  const [queries, pages, queryPages, dates, countries] = await Promise.all([
    both(["query"]),
    both(["page"]),
    fetchRows({
      projectId: input.projectId,
      dimensions: ["query", "page"],
      ...periods.current,
      filters,
    }),
    both(["date"]),
    // Countries are always unfiltered: the split is the point.
    both(["country"], []),
  ]);

  const queryRows = compareRows(queries[0].rows, queries[1].rows);
  const pageRows = compareRows(pages[0].rows, pages[1].rows);
  const siteUrl = queries[0].siteUrl;
  return {
    siteUrl,
    periods,
    country: input.country ?? null,
    totals: sumSearchTotals(dates[0].rows),
    previousTotals: sumSearchTotals(dates[1].rows),
    daily: dailySeries(dates[0].rows),
    previousDaily: dailySeries(dates[1].rows),
    countries: compareRows(countries[0].rows, countries[1].rows),
    queries: queryRows,
    pages: pageRows,
    opportunities: findOpportunities(queryRows),
    decliners: findDecliners(queries[0].rows, queries[1].rows),
    cannibalization: findCannibalization(queryPages.rows, queryRows),
  };
}

export type SearchConsoleOverview = Awaited<ReturnType<typeof getOverview>>;

type IndexIssue = {
  url: string;
  kind: "not_indexed" | "canonical" | "error";
  detail: string;
  lastCrawlTime: string | null;
};

/**
 * Index status of the pages with the most impressions: the ones Google left
 * out, and the ones where Google picked a different canonical.
 */
async function getIndexing(input: { projectId: string; days: number }) {
  const periods = comparisonPeriods(input.days);
  const { rows } = await fetchRows({
    projectId: input.projectId,
    dimensions: ["page"],
    ...periods.current,
    filters: [],
  });
  const urls = sort(rows, (a, b) => b.impressions - a.impressions)
    .slice(0, INSPECT_PAGE_LIMIT)
    .map((row) => row.keys?.[0] ?? "")
    .filter(Boolean);
  if (urls.length === 0) return { inspected: 0, issues: [] as IndexIssue[] };
  const inspection = await GscService.inspectUrls({
    projectId: input.projectId,
    urls,
  });
  const issues = inspection.results.flatMap((entry): IndexIssue[] => {
    const status = entry.result?.indexStatusResult;
    if (!status) {
      return entry.error
        ? [
            {
              url: entry.url,
              kind: "error",
              detail: entry.error,
              lastCrawlTime: null,
            },
          ]
        : [];
    }
    if (status.verdict && status.verdict !== "PASS") {
      return [
        {
          url: entry.url,
          kind: "not_indexed",
          detail: status.coverageState ?? status.verdict,
          lastCrawlTime: status.lastCrawlTime ?? null,
        },
      ];
    }
    if (
      status.googleCanonical &&
      status.userCanonical &&
      status.googleCanonical !== status.userCanonical
    ) {
      return [
        {
          url: entry.url,
          kind: "canonical",
          detail: `Google chose ${status.googleCanonical}`,
          lastCrawlTime: status.lastCrawlTime ?? null,
        },
      ];
    }
    return [];
  });
  return { inspected: urls.length, issues };
}


export const SearchConsoleService = { getOverview, getIndexing } as const;
