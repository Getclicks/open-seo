import { Globe } from "lucide-react";
import { useActiveMarket } from "@/client/features/markets/activeMarket";
import { marketKey, marketLabel, parseMarketKey } from "@/shared/markets";

/** Top-bar picker: narrow the app to one of the store's markets, or all. */
export function MarketSwitcher({ projectId }: { projectId: string }) {
  const { markets, active, setActive } = useActiveMarket(projectId);
  if (markets.length < 2) return null;
  return (
    <label className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-card pl-3 text-[13px]">
      <Globe className="size-4 text-muted-foreground" aria-hidden />
      <span className="sr-only">Market</span>
      <select
        data-slot="native-select"
        value={active ? marketKey(active) : ""}
        onChange={(event) => setActive(parseMarketKey(event.target.value))}
        className="min-h-10 bg-transparent pr-2 font-medium text-foreground outline-none"
      >
        <option value="">All markets</option>
        {markets.map((market) => (
          <option key={marketKey(market)} value={marketKey(market)}>
            {marketLabel(market)}
          </option>
        ))}
      </select>
    </label>
  );
}
