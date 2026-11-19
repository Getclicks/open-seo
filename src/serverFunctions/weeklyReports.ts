import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { WeeklyReportService } from "@/server/features/weekly-reports/WeeklyReportService";
import { ProjectNotesService } from "@/server/features/weekly-reports/ProjectNotesService";
import { StoresService } from "@/server/features/weekly-reports/StoresService";
import {
  requireAuthenticatedContext,
  requireProjectContext,
} from "@/serverFunctions/middleware";

const projectSchema = z.object({ projectId: z.string().min(1) });

export const getWeeklyReports = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(projectSchema)
  .handler(async ({ context }) => WeeklyReportService.list(context.projectId));

export const generateWeeklyReport = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(projectSchema)
  .handler(async ({ context }) =>
    WeeklyReportService.generate({
      projectId: context.projectId,
      trigger: "manual",
    }),
  );

export const setWeeklyReportActionStatus = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(
    projectSchema.extend({
      actionId: z.string().min(1).max(64),
      status: z.enum(["open", "in_progress", "done"]),
    }),
  )
  .handler(async ({ data, context }) => {
    await WeeklyReportService.setActionStatus({
      projectId: context.projectId,
      actionId: data.actionId,
      status: data.status,
    });
    return { ok: true };
  });

export const getWeeklyReportSettings = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(projectSchema)
  .handler(async ({ context }) =>
    WeeklyReportService.getSettings(context.projectId),
  );

export const updateWeeklyReportSettings = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(
    projectSchema.extend({
      enabled: z.boolean(),
      weekday: z.number().int().min(0).max(6),
      time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      timezone: z
        .string()
        .min(1)
        .max(64)
        .refine((zone) => {
          try {
            return Boolean(
              new Intl.DateTimeFormat("en-US", {
                timeZone: zone,
              }).resolvedOptions().timeZone,
            );
          } catch {
            return false;
          }
        }, "Unknown time zone"),
      includeGsc: z.boolean(),
      includeGeo: z.boolean(),
      emailEnabled: z.boolean(),
      recipients: z.array(z.email()).max(10),
    }),
  )
  .handler(async ({ data, context }) =>
    WeeklyReportService.updateSettings({
      ...data,
      projectId: context.projectId,
    }),
  );

export const getProjectNotes = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(projectSchema)
  .handler(async ({ context }) => ProjectNotesService.list(context.projectId));

export const addProjectNote = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(
    projectSchema.extend({
      noteDate: z.iso.date(),
      body: z.string().trim().min(1).max(500),
    }),
  )
  .handler(async ({ data, context }) =>
    ProjectNotesService.add({
      projectId: context.projectId,
      noteDate: data.noteDate,
      body: data.body,
    }),
  );

export const deleteProjectNote = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(projectSchema.extend({ noteId: z.string().min(1).max(64) }))
  .handler(async ({ data, context }) =>
    ProjectNotesService.remove({
      projectId: context.projectId,
      noteId: data.noteId,
    }),
  );

export const getStores = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .handler(async ({ context }) => StoresService.list(context.organizationId));
