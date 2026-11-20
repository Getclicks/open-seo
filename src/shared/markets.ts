import {
  getIsoCountryCode,
  getLanguageOptions,
  LOCATIONS,
} from "@/shared/keyword-locations";

/**
 * A market is a country plus the language the store sells in there (Belgium
 * in Dutch and Belgium in French are two markets). A store's primary market
 * is the project's own location and language.
 */
export type Market = { locationCode: number; languageCode: string };

export function marketKey(market: Market): string {
  return `${market.locationCode}-${market.languageCode}`;
}

export function parseMarketKey(key: string | null | undefined): Market | null {
  const match = /^(\d{4})-([a-z]{2,3}(?:-[a-z]{2,4})?)$/i.exec(key ?? "");
  if (!match) return null;
  return {
    locationCode: Number(match[1]),
    languageCode: match[2].toLowerCase(),
  };
}

export function sameMarket(a: Market, b: Market) {
  return a.locationCode === b.locationCode && a.languageCode === b.languageCode;
}

/**
 * ISO 3166-1 alpha-3, lower case, as Search Console reports countries.
 * Keyed by alpha-2 (the location's short label) so every country DataForSEO
 * knows can be mapped once listed here.
 */
const ALPHA2_TO_ALPHA3: Record<string, string> = {
  nl: "nld",
  be: "bel",
  fr: "fra",
  de: "deu",
  lu: "lux",
  at: "aut",
  ch: "che",
  gb: "gbr",
  us: "usa",
  es: "esp",
  it: "ita",
  ie: "irl",
  dk: "dnk",
  se: "swe",
  no: "nor",
  fi: "fin",
  pl: "pol",
  pt: "prt",
  ca: "can",
  au: "aus",
};

/** The Search Console country filter for a market; null if unmapped. */
export function gscCountryForLocation(locationCode: number): string | null {
  return ALPHA2_TO_ALPHA3[getIsoCountryCode(locationCode)] ?? null;
}

/**
 * Short label: "NL", or "BE (fr)" when the country's language needs saying
 * (a multi-language country, or a language other than its default).
 */
export function marketLabel(market: Market): string {
  const country = LOCATIONS[market.locationCode] ?? String(market.locationCode);
  const languages = getLanguageOptions(market.locationCode);
  const isDefault =
    languages.length <= 1 && languages[0]?.code === market.languageCode;
  return isDefault ? country : `${country} (${market.languageCode})`;
}
