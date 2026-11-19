import { createFileRoute } from "@tanstack/react-router";
import { WeeklyReportSettings } from "@/client/features/weekly-reports/WeeklyReportSettings";

export const Route = createFileRoute(
  "/_app/p/$projectId/settings/weekly-report",
)({
  component: WeeklyReportSettingsRoute,
});

function WeeklyReportSettingsRoute() {
  const { projectId } = Route.useParams();
  return <WeeklyReportSettings projectId={projectId} />;
}
