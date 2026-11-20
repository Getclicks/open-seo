import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { getProjectMarkets } from "@/serverFunctions/markets";
import {
  gscCountryForLocation,
  marketKey,
  marketLabel,
  parseMarketKey,
  sameMarket,
  type Market,
} from "@/shared/markets";

/**
 * The market picked in the top bar, per store and per browser. It narrows
 * Search Console to the market's country and preselects the market in the
 * research forms; "All markets" (no key) means no narrowing.
 */

const storageKey = (projectId: string) => `seo-app:market:${projectId}`;
const listeners = new Set<() => void>();
// Fallback when storage is blocked (private windows, previews).
const memory = new Map<string, string>();

function read(projectId: string): string {
  try {
    return window.localStorage.getItem(storageKey(projectId)) ?? "";
  } catch {
    return memory.get(projectId) ?? "";
  }
}

function write(projectId: string, key: string) {
  memory.set(projectId, key);
  try {
    if (key) window.localStorage.setItem(storageKey(projectId), key);
    else window.localStorage.removeItem(storageKey(projectId));
  } catch {
    // Kept in memory for this visit.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const projectMarketsQuery = (projectId: string) => ({
  queryKey: ["project-markets", projectId],
  queryFn: () => getProjectMarkets({ data: { projectId } }),
  staleTime: 5 * 60_000,
});

export function useStoreMarkets(projectId: string | null) {
  return useQuery({
    ...projectMarketsQuery(projectId ?? ""),
    enabled: projectId !== null,
  });
}

/** The store's markets and the one picked in the top bar (null = all). */
export function useActiveMarket(projectId: string | null) {
  const stored = useSyncExternalStore(
    subscribe,
    () => (projectId ? read(projectId) : ""),
    () => "",
  );
  const markets = useStoreMarkets(projectId).data ?? [];
  const parsed = parseMarketKey(stored);
  // A market removed in settings, or one from another store, falls back to all.
  const active: Market | null =
    parsed && markets.some((market) => sameMarket(market, parsed))
      ? parsed
      : null;
  return {
    markets,
    active,
    setActive: (market: Market | null) => {
      if (projectId) write(projectId, market ? marketKey(market) : "");
    },
  };
}

/**
 * The Search Console country for the top bar's market (undefined = all
 * countries), and how to name it. Two markets in one country (Belgium in
 * Dutch and in French) share a country: Search Console can't split them.
 */
export function useMarketCountry(projectId: string) {
  const { active } = useActiveMarket(projectId);
  const country = active
    ? (gscCountryForLocation(active.locationCode) ?? undefined)
    : undefined;
  return {
    country,
    label: active ? marketLabel(active) : "all markets",
  };
}
