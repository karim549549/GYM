CREATE TABLE "named_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"name" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "named_forms_id_workspace_key" UNIQUE("id","workspace_id"),
	CONSTRAINT "named_forms_purpose_check" CHECK ("named_forms"."purpose" in ('intake', 'checkin')),
	CONSTRAINT "named_forms_name_check" CHECK (char_length("named_forms"."name") between 1 and 60)
);
--> statement-breakpoint
ALTER TABLE "form_templates" DROP CONSTRAINT "form_templates_purpose_version_key";--> statement-breakpoint
DROP INDEX "form_templates_one_active_idx";--> statement-breakpoint
ALTER TABLE "form_templates" ADD COLUMN "named_form_id" uuid;--> statement-breakpoint
ALTER TABLE "intake_links" ADD COLUMN "named_form_id" uuid;--> statement-breakpoint
ALTER TABLE "named_forms" ADD CONSTRAINT "named_forms_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "named_forms_workspace_id_idx" ON "named_forms" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "form_templates" ADD CONSTRAINT "form_templates_named_form_workspace_fk" FOREIGN KEY ("named_form_id","workspace_id") REFERENCES "public"."named_forms"("id","workspace_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_links" ADD CONSTRAINT "intake_links_named_form_workspace_fk" FOREIGN KEY ("named_form_id","workspace_id") REFERENCES "public"."named_forms"("id","workspace_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "form_templates_purpose_version_key" ON "form_templates" USING btree ("workspace_id","purpose","version") WHERE "form_templates"."named_form_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "form_templates_named_version_key" ON "form_templates" USING btree ("named_form_id","version") WHERE "form_templates"."named_form_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "form_templates_named_one_active_idx" ON "form_templates" USING btree ("named_form_id") WHERE "form_templates"."is_active" and "form_templates"."named_form_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "form_templates_one_active_idx" ON "form_templates" USING btree ("workspace_id","purpose") WHERE "form_templates"."is_active" and "form_templates"."named_form_id" is null;