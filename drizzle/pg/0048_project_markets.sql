CREATE TABLE "project_markets" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"location_code" integer NOT NULL,
	"language_code" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_markets" ADD CONSTRAINT "project_markets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_markets_project_market_idx" ON "project_markets" USING btree ("project_id","location_code","language_code");