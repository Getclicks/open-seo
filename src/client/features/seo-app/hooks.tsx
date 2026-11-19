import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { projectsQueryOptions } from "@/client/features/projects/projectQueries";
import { Button } from "@/client/components/ui/button";
import { getSearchConsoleOverview } from "@/serverFunctions/searchConsole";
import { Panel } from "@/client/features/seo-app/ui";

export function useProject(projectId: string) {
  const projectsQuery = useQuery(projectsQueryOptions());
  return (
    projectsQuery.data?.find((project) => project.id === projectId) ?? null
  );
}

/** Shared by the dashboard and the Search Console screen. */
export function searchConsoleOverviewQuery(input: {
  projectId: string;
  days: 7 | 28 | 90;
  country?: string;
}) {
  return {
    queryKey: [
      "search-console-overview",
      input.projectId,
      input.days,
      input.country ?? null,
    ],
    queryFn: () => getSearchConsoleOverview({ data: input }),
    staleTime: 10 * 60_000,
  };
}

export function ConnectSearchConsole({ projectId }: { projectId: string }) {
  return (
    <Panel title="Connect Search Console">
      <div className="flex flex-col items-start gap-3 text-sm text-muted-foreground">
        <p className="m-0 max-w-prose leading-relaxed">
          This screen shows your real Google clicks, positions and index status.
          Connect the store's Search Console property, with your own Google
          account or with the service account, to fill it.
        </p>
        <Button
          nativeButton={false}
          render={
            <Link
              to="/p/$projectId/settings/integrations"
              params={{ projectId }}
            />
          }
        >
          Connect Search Console
        </Button>
      </div>
    </Panel>
  );
}
