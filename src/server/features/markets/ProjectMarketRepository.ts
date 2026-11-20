import { and, asc, eq, inArray, max } from "drizzle-orm";
import { db } from "@/db";
import { projectMarkets } from "@/db/schema";
import type { Market } from "@/shared/markets";

async function listForProjects(projectIds: string[]) {
  if (projectIds.length === 0) return [];
  return db
    .select({
      projectId: projectMarkets.projectId,
      locationCode: projectMarkets.locationCode,
      languageCode: projectMarkets.languageCode,
    })
    .from(projectMarkets)
    .where(inArray(projectMarkets.projectId, projectIds))
    .orderBy(asc(projectMarkets.position));
}

async function insert(projectId: string, market: Market) {
  const [row] = await db
    .select({ last: max(projectMarkets.position) })
    .from(projectMarkets)
    .where(eq(projectMarkets.projectId, projectId));
  await db
    .insert(projectMarkets)
    .values({
      id: crypto.randomUUID(),
      projectId,
      locationCode: market.locationCode,
      languageCode: market.languageCode,
      position: (row?.last ?? -1) + 1,
    })
    .onConflictDoNothing();
}

async function remove(projectId: string, market: Market) {
  await db
    .delete(projectMarkets)
    .where(
      and(
        eq(projectMarkets.projectId, projectId),
        eq(projectMarkets.locationCode, market.locationCode),
        eq(projectMarkets.languageCode, market.languageCode),
      ),
    );
}

export const ProjectMarketRepository = { listForProjects, insert, remove };
