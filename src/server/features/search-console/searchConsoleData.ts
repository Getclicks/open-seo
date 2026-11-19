import { sort } from "remeda";
import type { GscSearchAnalyticsRow } from "@/server/lib/gscClient";
import { sumSearchTotals } from "@/server/features/gsc/searchPerformanceReport";
import {
  CANNIBALIZATION_MIN_IMPRESSIONS,
  CANNIBALIZATION_MIN_SHARE,
  DECLINER_MIN_DROP,
  DECLINER_MIN_PREVIOUS_CLICKS,
  OPPORTUNITY_MAX_POSITION,
  OPPORTUNITY_MIN_IMPRESSIONS,
  OPPORTUNITY_MIN_POSITION,
} from "@/shared/search-console";

/**
 * Pure shaping for the Search Console screen: the current period's rows
 * joined with the previous period's, and the opportunity, decliner and
 * cannibalization lists derived from them.
 */

export type ComparedRow = {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  previousClicks: number;
  previousPosition: number | null;
  /** Change in clicks as a fraction (0.12 = +12%); null without a baseline. */
  clicksChange: number | null;
};

type CannibalizedQuery = ComparedRow & {
  pages: Array<{
    page: string;
    clicks: number;
    position: number;
    impressionShare: number;
  }>;
};

function keyOf(row: GscSearchAnalyticsRow, index = 0) {
  return row.keys?.[index] ?? "";
}

export function compareRows(
  current: GscSearchAnalyticsRow[],
  previous: GscSearchAnalyticsRow[],
): ComparedRow[] {
  const before = new Map(previous.map((row) => [keyOf(row), row]));
  return sort(
    current.map((row) => {
      const prev = before.get(keyOf(row));
      const previousClicks = prev?.clicks ?? 0;
      return {
        key: keyOf(row),
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
        previousClicks,
        previousPosition: prev?.position ?? null,
        clicksChange:
          previousClicks > 0
            ? (row.clicks - previousClicks) / previousClicks
            : null,
      };
    }),
    (a, b) => b.clicks - a.clicks || b.impressions - a.impressions,
  );
}

/** Positions 11–20 with enough impressions, most impressions first. */
export function findOpportunities(rows: ComparedRow[]): ComparedRow[] {
  return sort(
    rows.filter(
      (row) =>
        row.position >= OPPORTUNITY_MIN_POSITION &&
        row.position <= OPPORTUNITY_MAX_POSITION &&
        row.impressions >= OPPORTUNITY_MIN_IMPRESSIONS,
    ),
    (a, b) => b.impressions - a.impressions,
  );
}

/**
 * Queries that lost more than a fifth of their clicks, biggest loss first.
 * A query that vanished from the current period entirely counts too.
 */
export function findDecliners(
  current: GscSearchAnalyticsRow[],
  previous: GscSearchAnalyticsRow[],
): ComparedRow[] {
  const now = new Map(current.map((row) => [keyOf(row), row]));
  return sort(
    previous
      .filter((prev) => prev.clicks >= DECLINER_MIN_PREVIOUS_CLICKS)
      .map((prev): ComparedRow => {
        const row = now.get(keyOf(prev));
        const clicks = row?.clicks ?? 0;
        return {
          key: keyOf(prev),
          clicks,
          impressions: row?.impressions ?? 0,
          ctr: row?.ctr ?? 0,
          position: row?.position ?? 0,
          previousClicks: prev.clicks,
          previousPosition: prev.position,
          clicksChange: (clicks - prev.clicks) / prev.clicks,
        };
      })
      .filter((row) => (row.clicksChange ?? 0) <= -DECLINER_MIN_DROP),
    (a, b) => b.previousClicks - b.clicks - (a.previousClicks - a.clicks),
  );
}

/**
 * Queries where two or more of the site's own pages each take a real share
 * of the impressions, from query+page rows.
 */
export function findCannibalization(
  queryPageRows: GscSearchAnalyticsRow[],
  queries: ComparedRow[],
): CannibalizedQuery[] {
  const byQuery = new Map<string, GscSearchAnalyticsRow[]>();
  for (const row of queryPageRows) {
    const query = keyOf(row, 0);
    const list = byQuery.get(query) ?? [];
    list.push(row);
    byQuery.set(query, list);
  }
  const compared = new Map(queries.map((row) => [row.key, row]));
  const result: CannibalizedQuery[] = [];
  for (const [query, rows] of byQuery) {
    const total = rows.reduce((sum, row) => sum + row.impressions, 0);
    if (total < CANNIBALIZATION_MIN_IMPRESSIONS) continue;
    const pages = sort(
      rows
        .map((row) => ({
          page: keyOf(row, 1),
          clicks: row.clicks,
          position: row.position,
          impressionShare: row.impressions / total,
        }))
        .filter((page) => page.impressionShare >= CANNIBALIZATION_MIN_SHARE),
      (a, b) => b.impressionShare - a.impressionShare,
    );
    if (pages.length < 2) continue;
    const totals = sumSearchTotals(rows);
    const base = compared.get(query);
    result.push({
      key: query,
      clicks: totals.clicks,
      impressions: totals.impressions,
      ctr: totals.ctr,
      position: totals.position,
      previousClicks: base?.previousClicks ?? 0,
      previousPosition: base?.previousPosition ?? null,
      clicksChange: base?.clicksChange ?? null,
      pages,
    });
  }
  return sort(result, (a, b) => b.impressions - a.impressions);
}

/** Daily clicks keyed by date, for the trend chart. */
export function dailySeries(rows: GscSearchAnalyticsRow[]) {
  return sort(
    rows.map((row) => ({
      date: keyOf(row),
      clicks: row.clicks,
      impressions: row.impressions,
    })),
    (a, b) => a.date.localeCompare(b.date),
  );
}
