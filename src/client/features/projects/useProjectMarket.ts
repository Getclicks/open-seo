import { useQuery } from "@tanstack/react-query";
import { projectsQueryOptions } from "@/client/features/projects/projectQueries";
import { useActiveMarket } from "@/client/features/markets/activeMarket";
import type { ProjectMarket } from "./types";

/**
 * The market research forms start from: the one picked in the top bar, else
 * the project's primary market. Undefined until the projects query resolves.
 */
export function useProjectMarket(projectId: string): ProjectMarket | undefined {
  const projectsQuery = useQuery(projectsQueryOptions());
  const { active } = useActiveMarket(projectId);
  const project = projectsQuery.data?.find(
    (candidate) => candidate.id === projectId,
  );
  if (!project) return undefined;
  return active ?? project;
}
