import { sort } from "remeda";
import type { SearchConsoleOverview } from "@/server/features/search-console/SearchConsoleService";
import type { GeoAuditResult } from "@/server/features/geo/GeoAuditService";

/**
 * Turns a week of Search Console data and a GEO audit into the weekly
 * report: a plain-language summary and three to five concrete actions.
 * Pure, so the wording and the priorities are testable.
 */

export type ReportAction = {
  title: string;
  detail: string | null;
  module: "search-console" | "geo" | "keywords";
  impact: "high" | "medium" | "low";
};

type IndexIssue = { url: string; kind: string; detail: string };

/** A store market as the report names it, with its Search Console country. */
type ReportMarket = { label: string; country: string | null };

type WeeklyReportInput = {
  /** The store's markets; only a store in two or more countries gets the line. */
  markets?: ReportMarket[];
  gsc: SearchConsoleOverview | null;
  indexIssues: IndexIssue[] | null;
  geo: GeoAuditResult | null;
  previousGeoScore: number | null;
};

const MAX_ACTIONS = 5;
const IMPACT_ORDER = { high: 0, medium: 1, low: 2 } as const;

const number = (value: number) => Math.round(value).toLocaleString("en-US");
const pct = (value: number) => `${Math.abs(Math.round(value * 100))}%`;
const position = (value: number) => value.toFixed(1);

function path(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

function gscSummary(gsc: SearchConsoleOverview) {
  const clicks = gsc.totals.clicks;
  const previous = gsc.previousTotals.clicks;
  const parts: string[] = [];
  if (previous > 0) {
    const change = (clicks - previous) / previous;
    parts.push(
      Math.abs(change) < 0.02
        ? `Clicks held steady at ${number(clicks)} (the 7 days before: ${number(previous)}).`
        : `Clicks ${change > 0 ? "rose" : "fell"} ${pct(change)} to ${number(clicks)} (the 7 days before: ${number(previous)}).`,
    );
  } else {
    parts.push(`${number(clicks)} clicks from Google this week.`);
  }
  const gainers = sort(
    gsc.queries.filter((row) => row.clicks - row.previousClicks >= 3),
    (a, b) => b.clicks - b.previousClicks - (a.clicks - a.previousClicks),
  ).slice(0, 2);
  if (gainers.length > 0) {
    parts.push(
      `Most of the gain came from ${gainers.map((row) => `"${row.key}"`).join(" and ")}.`,
    );
  }
  const loser = gsc.decliners[0];
  if (loser) {
    parts.push(
      `"${loser.key}" lost the most: ${number(loser.previousClicks - loser.clicks)} clicks${
        loser.previousPosition
          ? `, position ${position(loser.previousPosition)} → ${loser.position ? position(loser.position) : "gone"}`
          : ""
      }.`,
    );
  }
  const weakCountry = sort(
    gsc.countries.filter((row) => row.impressions >= 200),
    (a, b) => a.ctr - b.ctr,
  )[0];
  if (weakCountry && gsc.countries.length > 1 && weakCountry.position > 12) {
    parts.push(
      `${weakCountry.key.toUpperCase()} lags behind at an average position of ${position(weakCountry.position)}.`,
    );
  }
  return parts.join(" ");
}

function geoSummary(geo: GeoAuditResult, previous: number | null) {
  const change =
    previous === null
      ? ""
      : geo.score === previous
        ? " (unchanged)"
        : ` (${geo.score > previous ? "+" : ""}${geo.score - previous})`;
  const weakest = sort(
    geo.categories.filter((item) => item.score !== null && item.score < 60),
    (a, b) => (a.score ?? 0) - (b.score ?? 0),
  )
    .slice(0, 2)
    .map((item) => item.label);
  return `The GEO score is ${geo.score}${change}.${
    weakest.length > 0
      ? ` The biggest open points are ${weakest.join(" and ")}.`
      : " No category scores below 60."
  }`;
}

function gscActions(gsc: SearchConsoleOverview): ReportAction[] {
  const actions: ReportAction[] = [];
  const decliner = gsc.decliners[0];
  if (decliner) {
    actions.push({
      title: `Find out why "${decliner.key}" lost ${pct(decliner.clicksChange ?? 0)} of its clicks`,
      detail: decliner.previousPosition
        ? `Position ${position(decliner.previousPosition)} → ${decliner.position ? position(decliner.position) : "not ranking"}. Compare the result page with last week's.`
        : null,
      module: "search-console",
      impact: "high",
    });
  }
  for (const row of gsc.opportunities.slice(0, 2)) {
    actions.push({
      title: `Push "${row.key}" onto page one`,
      detail: `Position ${position(row.position)} with ${number(row.impressions)} impressions: sharpen the title and add the content searchers miss.`,
      module: "search-console",
      impact: row.impressions >= 1000 ? "high" : "medium",
    });
  }
  const cannibal = gsc.cannibalization[0];
  if (cannibal) {
    actions.push({
      title: `Pick one page for "${cannibal.key}"`,
      detail: `${cannibal.pages.length} of your pages compete: ${cannibal.pages
        .map((page) => path(page.page))
        .join(", ")}.`,
      module: "search-console",
      impact: "medium",
    });
  }
  return actions;
}

const GEO_ACTION: Partial<
  Record<string, (geo: GeoAuditResult) => ReportAction | null>
> = {
  llms_txt: () => ({
    title: "Publish llms.txt",
    detail: "A ready-made file is on the GEO page under Suggested fixes.",
    module: "geo",
    impact: "medium",
  }),
  robots: (geo) => {
    const blocked = geo.bots.filter(
      (bot) => bot.kind === "search" && bot.status !== "allowed",
    );
    return blocked.length === 0
      ? null
      : {
          title: `Allow ${blocked.map((bot) => bot.agent).join(", ")} in robots.txt`,
          detail: "AI search can't cite pages it may not read.",
          module: "geo",
          impact: "high",
        };
  },
  schema: () => ({
    title: "Complete the Product schema with reviews and GTIN",
    detail: "See Suggested fixes on the GEO page.",
    module: "geo",
    impact: "medium",
  }),
  entity: () => ({
    title: "Add Organization schema with links to your social profiles",
    detail: null,
    module: "geo",
    impact: "low",
  }),
  meta: (geo) => ({
    title: "Write the missing or duplicate meta descriptions",
    detail: geo.categories.find((item) => item.key === "meta")?.note ?? null,
    module: "geo",
    impact: "low",
  }),
  content: (geo) => {
    const weakest = geo.pages.at(-1);
    return weakest
      ? {
          title: `Make ${path(weakest.url)} easier for AI answers to quote`,
          detail: weakest.gap,
          module: "geo",
          impact: "medium",
        }
      : null;
  },
  discovery: (geo) => ({
    title: "Fix how AI crawlers find your pages",
    detail:
      geo.categories.find((item) => item.key === "discovery")?.note ?? null,
    module: "geo",
    impact: "low",
  }),
};

function geoActions(geo: GeoAuditResult): ReportAction[] {
  return sort(
    geo.categories.filter((item) => item.score !== null && item.score < 60),
    (a, b) => (a.score ?? 0) - (b.score ?? 0),
  ).flatMap((item) => GEO_ACTION[item.key]?.(geo) ?? []);
}

/**
 * "Per market: NL 512 (+8%), BE 140 (−3%)." for a store in several markets.
 * Markets that share a country (Belgium in Dutch and French) share one
 * figure: Search Console counts clicks per country, not per language.
 */
function marketSummary(gsc: SearchConsoleOverview, markets: ReportMarket[]) {
  const countries = new Map<string, string>();
  for (const market of markets) {
    if (market.country && !countries.has(market.country)) {
      countries.set(market.country, market.label);
    }
  }
  if (countries.size < 2) return null;
  const parts = [...countries].map(([country, label]) => {
    const row = gsc.countries.find((entry) => entry.key === country);
    if (!row) return `${label} 0`;
    const change =
      row.previousClicks > 0
        ? ` (${row.clicks >= row.previousClicks ? "+" : "−"}${pct(
            (row.clicks - row.previousClicks) / row.previousClicks,
          )})`
        : "";
    return `${label} ${number(row.clicks)}${change}`;
  });
  return `Clicks per market: ${parts.join(", ")}.`;
}

export function buildWeeklyReport(input: WeeklyReportInput) {
  const summary = [
    input.gsc
      ? gscSummary(input.gsc)
      : "Search Console isn't connected, so this report has no Google data.",
    input.gsc && input.markets ? marketSummary(input.gsc, input.markets) : null,
    input.geo ? geoSummary(input.geo, input.previousGeoScore) : null,
  ]
    .filter(Boolean)
    .join(" ");

  const indexActions: ReportAction[] = (input.indexIssues ?? [])
    .filter((issue) => issue.kind !== "error")
    .slice(0, 1)
    .map((issue) => ({
      title:
        issue.kind === "canonical"
          ? `Check the canonical of ${path(issue.url)}`
          : `Get ${path(issue.url)} indexed`,
      detail: issue.detail,
      module: "search-console",
      impact: "medium",
    }));

  const candidates = [
    ...(input.gsc ? gscActions(input.gsc) : []),
    ...indexActions,
    ...(input.geo ? geoActions(input.geo) : []),
  ];
  // Stable sort keeps each source's own order within an impact level.
  const actions = sort(
    candidates.map((action, index) => ({ action, index })),
    (a, b) =>
      IMPACT_ORDER[a.action.impact] - IMPACT_ORDER[b.action.impact] ||
      a.index - b.index,
  )
    .slice(0, MAX_ACTIONS)
    .map(({ action }) => action);

  return {
    summary,
    clicks: input.gsc?.totals.clicks ?? null,
    previousClicks: input.gsc?.previousTotals.clicks ?? null,
    opportunities: input.gsc?.opportunities.length ?? null,
    indexIssues: input.indexIssues
      ? input.indexIssues.filter((issue) => issue.kind !== "error").length
      : null,
    geoScore: input.geo?.score ?? null,
    actions,
  };
}
