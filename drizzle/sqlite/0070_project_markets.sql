CREATE TABLE `project_markets` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`location_code` integer NOT NULL,
	`language_code` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_markets_project_market_idx` ON `project_markets` (`project_id`,`location_code`,`language_code`);