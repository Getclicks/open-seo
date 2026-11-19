export const SEARCH_CONSOLE_TABS = [
  "queries",
  "pages",
  "opportunities",
  "decliners",
  "cannibalization",
  "indexing",
] as const;

export type SearchConsoleTab = (typeof SEARCH_CONSOLE_TABS)[number];

export const SEARCH_CONSOLE_TAB_LABELS: Record<SearchConsoleTab, string> = {
  queries: "Queries",
  pages: "Pages",
  opportunities: "Opportunities",
  decliners: "Decliners",
  cannibalization: "Cannibalization",
  indexing: "Indexing",
};

/** Opportunities: ranking just off page one with real impressions. */
export const OPPORTUNITY_MIN_POSITION = 11;
export const OPPORTUNITY_MAX_POSITION = 20;
export const OPPORTUNITY_MIN_IMPRESSIONS = 100;

/** Decliners: lost more than this share of clicks vs the previous period. */
export const DECLINER_MIN_DROP = 0.2;
export const DECLINER_MIN_PREVIOUS_CLICKS = 5;

/** Cannibalization: a page needs this share of a query's impressions to count. */
export const CANNIBALIZATION_MIN_SHARE = 0.1;
export const CANNIBALIZATION_MIN_IMPRESSIONS = 50;

/** GSC reports countries as ISO 3166-1 alpha-3, lower case. */
const GSC_COUNTRY_NAMES: Record<string, string> = {
  nld: "Netherlands",
  bel: "Belgium",
  fra: "France",
  deu: "Germany",
  lux: "Luxembourg",
  gbr: "United Kingdom",
  usa: "United States",
  esp: "Spain",
  ita: "Italy",
  aut: "Austria",
  che: "Switzerland",
};

export function gscCountryName(code: string): string {
  return GSC_COUNTRY_NAMES[code.toLowerCase()] ?? code.toUpperCase();
}
