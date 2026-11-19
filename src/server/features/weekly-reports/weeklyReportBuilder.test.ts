import { expect, it } from "vitest";
import type { SearchConsoleOverview } from "@/server/features/search-console/SearchConsoleService";
import type { GeoAuditResult } from "@/server/features/geo/GeoAuditService";
import { buildWeeklyReport } from "./weeklyReportBuilder";

const totals = { clicks: 0, impressions: 0, ctr: 0, position: 0 };
const compared = (key: string, impressions: number, extra = {}) => ({
  key,
  clicks: 10,
  impressions,
  ctr: 0.01,
  position: 14,
  previousClicks: 10,
  previousPosition: 14,
  clicksChange: 0,
  ...extra,
});

function overview(
  overrides: Partial<SearchConsoleOverview>,
): SearchConsoleOverview {
  return {
    siteUrl: "sc-domain:shop.example",
    periods: {
      current: { startDate: "2026-11-09", endDate: "2026-11-15" },
      previous: { startDate: "2026-11-02", endDate: "2026-11-08" },
    },
    country: null,
    totals,
    previousTotals: totals,
    daily: [],
    previousDaily: [],
    countries: [],
    queries: [],
    pages: [],
    opportunities: [],
    decliners: [],
    cannibalization: [],
    ...overrides,
  };
}

const weakCategory = (key: "llms_txt" | "entity" | "meta", score: number) => ({
  key,
  label: key,
  weight: 10,
  score,
  note: "",
});

const geo: GeoAuditResult = {
  origin: "https://shop.example",
  score: 40,
  band: "Moderate",
  categories: [
    weakCategory("llms_txt", 0),
    weakCategory("entity", 20),
    weakCategory("meta", 30),
  ],
  bots: [],
  pages: [],
  fixes: [],
  unreadable: [],
};

it("puts high-impact actions first and keeps at most five", () => {
  const report = buildWeeklyReport({
    gsc: overview({
      opportunities: [compared("small", 300), compared("big", 5000)],
      decliners: [
        compared("lost", 0, {
          clicks: 2,
          previousClicks: 20,
          clicksChange: -0.9,
        }),
      ],
      cannibalization: [
        {
          ...compared("shared", 400),
          pages: [
            {
              page: "https://shop.example/a",
              clicks: 5,
              position: 9,
              impressionShare: 0.6,
            },
            {
              page: "https://shop.example/b",
              clicks: 5,
              position: 12,
              impressionShare: 0.4,
            },
          ],
        },
      ],
    }),
    indexIssues: null,
    geo,
    previousGeoScore: null,
  });
  expect(report.actions).toHaveLength(5);
  expect(report.actions.map((action) => action.impact)).toEqual([
    "high",
    "high",
    "medium",
    "medium",
    "medium",
  ]);
  expect(report.actions[0]?.title).toContain('"lost"');
  expect(report.actions[1]?.title).toContain('"big"');
});
