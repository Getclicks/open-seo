import { dashboardSearchSchema } from "@/types/schemas/dashboard";
import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/client/features/dashboard/DashboardPage";
import { SeoDashboardPage } from "@/client/features/seo-app/SeoDashboardPage";
import { useProject } from "@/client/features/seo-app/hooks";
import { googleConnectionOptions } from "@/client/features/integrations/googleProviders";
import { pageHead } from "@/client/lib/pageHead";
import { queryClient } from "@/client/tanstack-db/queryClient";

export const Route = createFileRoute("/_app/p/$projectId/")({
  head: () => pageHead("Dashboard"),
  validateSearch: dashboardSearchSchema,
  loader: ({ params }) => {
    // Without Search Console, the dashboard opens on its connect card, which
    // needs this check: start it with the page's data, not after it.
    void queryClient.prefetchQuery(
      googleConnectionOptions("gsc", params.projectId),
    );
  },
  component: DashboardRoute,
});

function DashboardRoute() {
  const { projectId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const project = useProject(projectId);
  // A store with a domain gets the SEO App dashboard; a new one first goes
  // through OpenSEO's website setup on the original dashboard.
  if (project?.domain) {
    return <SeoDashboardPage key={projectId} projectId={projectId} />;
  }
  return (
    <DashboardPage
      key={projectId}
      projectId={projectId}
      tab={search.tab}
      onTabChange={(tab) => void navigate({ search: { tab } })}
    />
  );
}
