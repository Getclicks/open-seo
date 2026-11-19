import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  GscNotConnectedError,
  isExpectedGrantFailure,
} from "@/server/features/gsc/services/GscService";
import { SearchConsoleService } from "@/server/features/search-console/SearchConsoleService";
import { requireProjectContext } from "@/serverFunctions/middleware";

const overviewSchema = z.object({
  projectId: z.string().min(1),
  days: z.union([z.literal(7), z.literal(28), z.literal(90)]).default(28),
  country: z
    .string()
    .regex(/^[a-z]{3}$/)
    .optional(),
});

/** Not connected, or a dead/denied grant: the page shows the connect card. */
function isNotConnected(error: unknown) {
  return error instanceof GscNotConnectedError || isExpectedGrantFailure(error);
}

export const getSearchConsoleOverview = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(overviewSchema)
  .handler(async ({ data, context }) => {
    try {
      const overview = await SearchConsoleService.getOverview({
        projectId: context.projectId,
        days: data.days,
        country: data.country,
      });
      return { connected: true as const, ...overview };
    } catch (error) {
      if (isNotConnected(error)) return { connected: false as const };
      throw error;
    }
  });

export const getSearchConsoleIndexing = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(overviewSchema.pick({ projectId: true, days: true }))
  .handler(async ({ data, context }) => {
    try {
      const indexing = await SearchConsoleService.getIndexing({
        projectId: context.projectId,
        days: data.days,
      });
      return { connected: true as const, ...indexing };
    } catch (error) {
      if (isNotConnected(error)) return { connected: false as const };
      throw error;
    }
  });
