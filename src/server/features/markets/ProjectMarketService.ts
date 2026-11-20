import { ProjectMarketRepository } from "@/server/features/markets/ProjectMarketRepository";
import { AppError } from "@/server/lib/errors";
import { getLanguageOptions, LOCATIONS } from "@/shared/keyword-locations";
import { sameMarket, type Market } from "@/shared/markets";

type ProjectWithMarket = {
  id: string;
  locationCode: number;
  languageCode: string;
};

type StoreMarket = Market & { primary: boolean };

function withPrimary(
  project: ProjectWithMarket,
  extra: Market[],
): StoreMarket[] {
  const primary: Market = {
    locationCode: project.locationCode,
    languageCode: project.languageCode,
  };
  return [
    { ...primary, primary: true },
    ...extra
      .filter((market) => !sameMarket(market, primary))
      .map((market) => ({
        locationCode: market.locationCode,
        languageCode: market.languageCode,
        primary: false,
      })),
  ];
}

/**
 * Every market of each store, the primary one (the project's own location
 * and language) first. A store without extra rows has just its primary.
 */
async function listForProjects(
  projects: ProjectWithMarket[],
): Promise<Map<string, StoreMarket[]>> {
  const rows = await ProjectMarketRepository.listForProjects(
    projects.map((project) => project.id),
  );
  return new Map(
    projects.map((project) => [
      project.id,
      withPrimary(
        project,
        rows.filter((row) => row.projectId === project.id),
      ),
    ]),
  );
}

async function list(project: ProjectWithMarket): Promise<StoreMarket[]> {
  return (await listForProjects([project])).get(project.id) ?? [];
}

async function add(project: ProjectWithMarket, market: Market) {
  if (!LOCATIONS[market.locationCode]) {
    throw new AppError("VALIDATION_ERROR", "Unknown country.");
  }
  if (
    !getLanguageOptions(market.locationCode).some(
      (language) => language.code === market.languageCode,
    )
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "That language isn't available for this country.",
    );
  }
  const current = await list(project);
  if (current.some((existing) => sameMarket(existing, market))) {
    return current;
  }
  await ProjectMarketRepository.insert(project.id, market);
  return list(project);
}

async function remove(project: ProjectWithMarket, market: Market) {
  if (
    market.locationCode === project.locationCode &&
    market.languageCode === project.languageCode
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "The primary market is set in the store's general settings.",
    );
  }
  await ProjectMarketRepository.remove(project.id, market);
  return list(project);
}

export const ProjectMarketService = { list, listForProjects, add, remove };
