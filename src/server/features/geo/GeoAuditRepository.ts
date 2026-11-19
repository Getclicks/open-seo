import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { geoAudits } from "@/db/schema";

async function insert(input: {
  projectId: string;
  trigger: "manual" | "scheduled";
  score: number;
  result: string;
}) {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await db.insert(geoAudits).values({ id, createdAt, ...input });
  return { id, createdAt };
}

async function listForProject(projectId: string, limit: number) {
  return db
    .select({
      id: geoAudits.id,
      createdAt: geoAudits.createdAt,
      score: geoAudits.score,
      trigger: geoAudits.trigger,
    })
    .from(geoAudits)
    .where(eq(geoAudits.projectId, projectId))
    .orderBy(desc(geoAudits.createdAt))
    .limit(limit);
}

async function getForProject(projectId: string, auditId: string) {
  const rows = await db
    .select()
    .from(geoAudits)
    .where(and(eq(geoAudits.projectId, projectId), eq(geoAudits.id, auditId)))
    .limit(1);
  return rows[0] ?? null;
}

async function getLatest(projectId: string) {
  const rows = await db
    .select()
    .from(geoAudits)
    .where(eq(geoAudits.projectId, projectId))
    .orderBy(desc(geoAudits.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export const GeoAuditRepository = {
  insert,
  listForProject,
  getForProject,
  getLatest,
};
