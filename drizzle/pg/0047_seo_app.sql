CREATE TABLE "geo_audits" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"trigger" text NOT NULL,
	"score" integer NOT NULL,
	"result" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"note_date" text NOT NULL,
	"body" text NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_report_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"detail" text,
	"module" text NOT NULL,
	"impact" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_report_recipients" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"email" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_report_settings" (
	"project_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"weekday" integer DEFAULT 1 NOT NULL,
	"time" text DEFAULT '08:00' NOT NULL,
	"timezone" text DEFAULT 'Europe/Amsterdam' NOT NULL,
	"include_gsc" boolean DEFAULT true NOT NULL,
	"include_geo" boolean DEFAULT true NOT NULL,
	"email_enabled" boolean DEFAULT false NOT NULL,
	"drop_alert_enabled" boolean DEFAULT false NOT NULL,
	"next_run_at" text,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"clicks" integer,
	"previous_clicks" integer,
	"geo_audit_id" text,
	"geo_score" integer,
	"previous_geo_score" integer,
	"opportunities" integer,
	"index_issues" integer,
	"summary" text NOT NULL,
	"emailed_at" text
);
--> statement-breakpoint
ALTER TABLE "geo_audits" ADD CONSTRAINT "geo_audits_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_notes" ADD CONSTRAINT "project_notes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_report_actions" ADD CONSTRAINT "weekly_report_actions_report_id_weekly_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."weekly_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_report_recipients" ADD CONSTRAINT "weekly_report_recipients_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_report_settings" ADD CONSTRAINT "weekly_report_settings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_geo_audit_id_geo_audits_id_fk" FOREIGN KEY ("geo_audit_id") REFERENCES "public"."geo_audits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "geo_audits_project_created_idx" ON "geo_audits" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "project_notes_project_date_idx" ON "project_notes" USING btree ("project_id","note_date");--> statement-breakpoint
CREATE INDEX "weekly_report_actions_report_idx" ON "weekly_report_actions" USING btree ("report_id","position");--> statement-breakpoint
CREATE INDEX "weekly_report_recipients_project_idx" ON "weekly_report_recipients" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "weekly_reports_project_created_idx" ON "weekly_reports" USING btree ("project_id","created_at");