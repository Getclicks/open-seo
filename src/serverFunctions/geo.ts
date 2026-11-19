import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { GeoAuditService } from "@/server/features/geo/GeoAuditService";
import { requireProjectContext } from "@/serverFunctions/middleware";

const projectSchema = z.object({ projectId: z.string().min(1) });

export const getGeoAudit = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(projectSchema.extend({ auditId: z.string().max(64).optional() }))
  .handler(async ({ data, context }) =>
    GeoAuditService.get({
      projectId: context.projectId,
      auditId: data.auditId,
    }),
  );

export const runGeoAudit = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(projectSchema)
  .handler(async ({ context }) =>
    GeoAuditService.run({ projectId: context.projectId, trigger: "manual" }),
  );
