import { Link, useMatches } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SidebarTrigger } from "@/client/components/ui/sidebar";
import { projectsQueryOptions } from "@/client/features/projects/projectQueries";
import { MarketSwitcher } from "@/client/features/markets/MarketSwitcher";
import {
  findActiveModule,
  getProjectNavModules,
} from "@/client/navigation/items";

/** The bar above every page: where you are, and for which store. */
export function AppTopbar({ projectId }: { projectId: string | null }) {
  const matches = useMatches();
  const routeIds = matches.map((match) => match.routeId as string);
  const projectsQuery = useQuery({
    ...projectsQueryOptions(),
    enabled: projectId !== null,
  });
  const project =
    projectsQuery.data?.find((candidate) => candidate.id === projectId) ?? null;
  const section = projectId
    ? findActiveModule(getProjectNavModules(projectId), routeIds)
    : null;
  const pageTitle = matches
    .flatMap((match) => match.meta ?? [])
    .map((meta) => meta?.title)
    .filter((title): title is string => typeof title === "string")
    .at(-1);
  const sectionLabel =
    section?.label ?? pageTitle?.replace(/ - OpenSEO$/, "") ?? null;

  return (
    <div className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-card px-3 py-2 md:px-6">
      <SidebarTrigger aria-label="Toggle sidebar" className="md:hidden" />
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-muted-foreground"
      >
        {projectId ? (
          <Link
            to="/p/$projectId"
            params={{ projectId }}
            className="text-muted-foreground no-underline hover:text-foreground"
          >
            Home
          </Link>
        ) : (
          <Link
            to="/"
            className="text-muted-foreground no-underline hover:text-foreground"
          >
            Home
          </Link>
        )}
        {sectionLabel && section?.key !== "dashboard" ? (
          <>
            <span aria-hidden className="text-input">
              /
            </span>
            <span className="truncate">{sectionLabel}</span>
          </>
        ) : null}
        {(project?.domain ?? project?.name) ? (
          <>
            <span aria-hidden className="text-input">
              /
            </span>
            <span className="truncate font-medium text-foreground">
              {project.domain ?? project.name}
            </span>
          </>
        ) : null}
      </nav>
      {projectId ? <MarketSwitcher projectId={projectId} /> : null}
    </div>
  );
}
