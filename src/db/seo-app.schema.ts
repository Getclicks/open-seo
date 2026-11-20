import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { projects } from "./app.schema";

// ============================================================================
// SEO App: GEO audits, weekly reports with their actions, the weekly report
// schedule per project, and dashboard notes.
// ============================================================================

// One row per GEO audit. `result` is the audit's snapshot (categories, bot
// access, per-page citability, suggested fixes) exactly as it was shown: a
// report document read whole, never queried by its parts.
export const geoAudits = sqliteTable(
  "geo_audits",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    trigger: text("trigger", { enum: ["manual", "scheduled"] }).notNull(),
    score: integer("score").notNull(),
    result: text("result").notNull(),
  },
  (table) => [
    index("geo_audits_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
  ],
);

// The weekly report schedule. Absent row = defaults (Monday 08:00 Amsterdam).
export const weeklyReportSettings = sqliteTable("weekly_report_settings", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  // 0 = Sunday … 6 = Saturday.
  weekday: integer("weekday").notNull().default(1),
  // HH:MM in `timezone`.
  time: text("time").notNull().default("08:00"),
  timezone: text("timezone").notNull().default("Europe/Amsterdam"),
  includeGsc: integer("include_gsc", { mode: "boolean" })
    .notNull()
    .default(true),
  includeGeo: integer("include_geo", { mode: "boolean" })
    .notNull()
    .default(true),
  emailEnabled: integer("email_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  dropAlertEnabled: integer("drop_alert_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  nextRunAt: text("next_run_at"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const weeklyReportRecipients = sqliteTable(
  "weekly_report_recipients",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
  },
  (table) => [
    index("weekly_report_recipients_project_idx").on(table.projectId),
  ],
);

export const weeklyReports = sqliteTable(
  "weekly_reports",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    // Null when Search Console wasn't connected or not included.
    clicks: integer("clicks"),
    previousClicks: integer("previous_clicks"),
    geoAuditId: text("geo_audit_id").references(() => geoAudits.id, {
      onDelete: "set null",
    }),
    geoScore: integer("geo_score"),
    previousGeoScore: integer("previous_geo_score"),
    opportunities: integer("opportunities"),
    indexIssues: integer("index_issues"),
    summary: text("summary").notNull(),
    emailedAt: text("emailed_at"),
  },
  (table) => [
    index("weekly_reports_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
  ],
);

export const weeklyReportActions = sqliteTable(
  "weekly_report_actions",
  {
    id: text("id").primaryKey(),
    reportId: text("report_id")
      .notNull()
      .references(() => weeklyReports.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    detail: text("detail"),
    module: text("module", {
      enum: ["search-console", "geo", "keywords"],
    }).notNull(),
    impact: text("impact", { enum: ["high", "medium", "low"] }).notNull(),
    status: text("status", { enum: ["open", "in_progress", "done"] })
      .notNull()
      .default("open"),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    index("weekly_report_actions_report_idx").on(
      table.reportId,
      table.position,
    ),
  ],
);

export const projectNotes = sqliteTable(
  "project_notes",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    // The day the change was made (YYYY-MM-DD), shown on the trend.
    noteDate: text("note_date").notNull(),
    body: text("body").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    index("project_notes_project_date_idx").on(table.projectId, table.noteDate),
  ],
);

// The extra markets (country + language) a store sells in. The project's own
// locationCode/languageCode stays the primary market and is never stored
// here; a store with no rows sells in its primary market only.
export const projectMarkets = sqliteTable(
  "project_markets",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    locationCode: integer("location_code").notNull(),
    languageCode: text("language_code").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    uniqueIndex("project_markets_project_market_idx").on(
      table.projectId,
      table.locationCode,
      table.languageCode,
    ),
  ],
);
