import { createFileRoute } from "@tanstack/react-router";
import { GeoPage } from "@/client/features/geo/GeoPage";
import { pageHead } from "@/client/lib/pageHead";

export const Route = createFileRoute("/_app/p/$projectId/geo")({
  head: () => pageHead("GEO / AI visibility"),
  component: GeoRoute,
});

function GeoRoute() {
  const { projectId } = Route.useParams();
  return <GeoPage projectId={projectId} />;
}
