import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SearchConsolePage } from "@/client/features/search-console/SearchConsolePage";
import { pageHead } from "@/client/lib/pageHead";
import { SEARCH_CONSOLE_TABS } from "@/shared/search-console";

const searchSchema = z.object({
  tab: z.enum(SEARCH_CONSOLE_TABS).optional().catch(undefined),
  country: z.string().length(3).optional().catch(undefined),
  q: z.string().max(200).optional().catch(undefined),
});

export const Route = createFileRoute("/_app/p/$projectId/search-console")({
  head: () => pageHead("Search Console"),
  validateSearch: searchSchema,
  component: SearchConsoleRoute,
});

function SearchConsoleRoute() {
  const { projectId } = Route.useParams();
  const search = Route.useSearch();
  return <SearchConsolePage projectId={projectId} search={search} />;
}
