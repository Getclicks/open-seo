import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/client/components/ui/button";
import { ProjectMarketFields } from "@/client/features/projects/ProjectMarketFields";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { projectMarketsQuery } from "@/client/features/markets/activeMarket";
import {
  addProjectMarket,
  removeProjectMarket,
} from "@/serverFunctions/markets";
import {
  marketKey,
  marketLabel,
  sameMarket,
  type Market,
} from "@/shared/markets";

type StoreMarket = Market & { primary: boolean };

// The markets a Benelux-based store most often adds, in that order.
const SUGGESTED: Market[] = [
  { locationCode: 2528, languageCode: "nl" },
  { locationCode: 2056, languageCode: "nl" },
  { locationCode: 2056, languageCode: "fr" },
  { locationCode: 2250, languageCode: "fr" },
  { locationCode: 2276, languageCode: "de" },
];

/** The add form opens on the first suggestion the store doesn't have yet. */
function nextSuggestion(markets: Market[]): Market {
  return (
    SUGGESTED.find(
      (candidate) => !markets.some((market) => sameMarket(market, candidate)),
    ) ?? { locationCode: 2840, languageCode: "en" }
  );
}

/** The countries and languages a store sells in, as removable chips. */
export function MarketsEditor({
  projectId,
  markets,
}: {
  projectId: string;
  markets: StoreMarket[];
}) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Market>(() => nextSuggestion(markets));
  const onSaved = async (list: StoreMarket[]) => {
    queryClient.setQueryData(projectMarketsQuery(projectId).queryKey, list);
    await queryClient.invalidateQueries({ queryKey: ["stores"] });
  };
  const add = useMutation({
    mutationFn: (market: Market) =>
      addProjectMarket({ data: { projectId, ...market } }),
    onSuccess: async (list) => {
      await onSaved(list);
      setAdding(false);
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (market: Market) =>
      removeProjectMarket({ data: { projectId, ...market } }),
    onSuccess: onSaved,
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  return (
    <div className="flex flex-col gap-3">
      <ul
        aria-label="Markets"
        className="m-0 flex list-none flex-wrap items-center gap-2 p-0"
      >
        {markets.map((market) => (
          <li
            key={marketKey(market)}
            className="flex min-h-8 items-center gap-1 rounded-full border border-border bg-card py-0.5 pr-1 pl-3 text-[13px]"
          >
            <span className="font-medium">{marketLabel(market)}</span>
            {market.primary ? (
              <span className="pr-2 text-xs text-muted-foreground">
                primary
              </span>
            ) : (
              <button
                type="button"
                aria-label={`Remove ${marketLabel(market)}`}
                onClick={() => remove.mutate(market)}
                disabled={remove.isPending}
                className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </li>
        ))}
        {!adding ? (
          <li>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft(nextSuggestion(markets));
                setAdding(true);
              }}
            >
              + Add market
            </Button>
          </li>
        ) : null}
      </ul>
      {adding ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted p-4">
          <ProjectMarketFields value={draft} onChange={setDraft} />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAdding(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              pending={add.isPending}
              disabled={add.isPending}
              onClick={() => add.mutate(draft)}
            >
              Add market
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
