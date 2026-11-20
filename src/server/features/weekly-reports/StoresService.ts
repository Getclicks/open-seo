import { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";
import { GscConnectionRepository } from "@/server/features/gsc/repositories/GscConnectionRepository";
import { getServiceAccountEmail } from "@/server/features/google/serviceAccount";
import { ProjectMarketService } from "@/server/features/markets/ProjectMarketService";

/** Every store of the organization with its markets and Search Console status. */
async function list(organizationId: string) {
  const [projects, serviceAccountEmail] = await Promise.all([
    ProjectRepository.listProjects(organizationId),
    getServiceAccountEmail(),
  ]);
  const markets = await ProjectMarketService.listForProjects(projects);
  const stores = await Promise.all(
    projects.map(async (project) => {
      const connection = await GscConnectionRepository.getByProjectId(
        project.id,
      );
      return {
        id: project.id,
        name: project.name,
        domain: project.domain,
        locationCode: project.locationCode,
        languageCode: project.languageCode,
        markets: markets.get(project.id) ?? [],
        gscProperty: connection?.siteUrl ?? null,
        gscConnectedBy: connection?.connectedAccountEmail ?? null,
      };
    }),
  );
  return { stores, serviceAccountEmail };
}

export const StoresService = { list };
