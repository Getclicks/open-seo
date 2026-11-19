CREATE TABLE `geo_audits` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`trigger` text NOT NULL,
	`score` integer NOT NULL,
	`result` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `geo_audits_project_created_idx` ON `geo_audits` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `project_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`note_date` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_notes_project_date_idx` ON `project_notes` (`project_id`,`note_date`);--> statement-breakpoint
CREATE TABLE `weekly_report_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`position` integer NOT NULL,
	`title` text NOT NULL,
	`detail` text,
	`module` text NOT NULL,
	`impact` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `weekly_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `weekly_report_actions_report_idx` ON `weekly_report_actions` (`report_id`,`position`);--> statement-breakpoint
CREATE TABLE `weekly_report_recipients` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`email` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `weekly_report_recipients_project_idx` ON `weekly_report_recipients` (`project_id`);--> statement-breakpoint
CREATE TABLE `weekly_report_settings` (
	`project_id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`weekday` integer DEFAULT 1 NOT NULL,
	`time` text DEFAULT '08:00' NOT NULL,
	`timezone` text DEFAULT 'Europe/Amsterdam' NOT NULL,
	`include_gsc` integer DEFAULT true NOT NULL,
	`include_geo` integer DEFAULT true NOT NULL,
	`email_enabled` integer DEFAULT false NOT NULL,
	`drop_alert_enabled` integer DEFAULT false NOT NULL,
	`next_run_at` text,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `weekly_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`clicks` integer,
	`previous_clicks` integer,
	`geo_audit_id` text,
	`geo_score` integer,
	`previous_geo_score` integer,
	`opportunities` integer,
	`index_issues` integer,
	`summary` text NOT NULL,
	`emailed_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`geo_audit_id`) REFERENCES `geo_audits`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `weekly_reports_project_created_idx` ON `weekly_reports` (`project_id`,`created_at`);