import { createFileRoute } from "@tanstack/react-router";
import { StoresSettings } from "@/client/features/weekly-reports/StoresSettings";

export const Route = createFileRoute("/_app/p/$projectId/settings/stores")({
  component: StoresSettingsRoute,
});

function StoresSettingsRoute() {
  const { projectId } = Route.useParams();
  return <StoresSettings projectId={projectId} />;
}
