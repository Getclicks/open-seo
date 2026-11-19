import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { WeeklyReportsPage } from "@/client/features/weekly-reports/WeeklyReportsPage";
import { pageHead } from "@/client/lib/pageHead";

const searchSchema = z.object({
  report: z.string().max(64).optional().catch(undefined),
});

export const Route = createFileRoute("/_app/p/$projectId/weekly-reports")({
  head: () => pageHead("Weekly reports"),
  validateSearch: searchSchema,
  component: WeeklyReportsRoute,
});

function WeeklyReportsRoute() {
  const { projectId } = Route.useParams();
  const { report } = Route.useSearch();
  return <WeeklyReportsPage projectId={projectId} reportId={report} />;
}
