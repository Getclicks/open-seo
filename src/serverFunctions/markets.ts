import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ProjectMarketService } from "@/server/features/markets/ProjectMarketService";
import { requireProjectContext } from "@/serverFunctions/middleware";

const projectSchema = z.object({ projectId: z.string().min(1) });
const marketSchema = projectSchema.extend({
  locationCode: z.number().int().positive(),
  languageCode: z.string().min(2).max(8),
});

export const getProjectMarkets = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(projectSchema)
  .handler(async ({ context }) => ProjectMarketService.list(context.project));

export const addProjectMarket = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(marketSchema)
  .handler(async ({ data, context }) =>
    ProjectMarketService.add(context.project, {
      locationCode: data.locationCode,
      languageCode: data.languageCode,
    }),
  );

export const removeProjectMarket = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(marketSchema)
  .handler(async ({ data, context }) =>
    ProjectMarketService.remove(context.project, {
      locationCode: data.locationCode,
      languageCode: data.languageCode,
    }),
  );
