CREATE TABLE "form_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"label_ar" text NOT NULL,
	"label_en" text,
	"help_text" text,
	"input_type" text NOT NULL,
	"options" jsonb,
	"is_required" boolean DEFAULT false NOT NULL,
	"unit" text,
	"maps_to_metric" text,
	"min_value" numeric(10, 2),
	"max_value" numeric(10, 2),
	"is_integer" boolean DEFAULT false NOT NULL,
	"max_length" integer,
	CONSTRAINT "form_questions_template_position_key" UNIQUE("template_id","position"),
	CONSTRAINT "form_questions_input_type_check" CHECK ("form_questions"."input_type" in ('short_text', 'long_text', 'number', 'single_select', 'multi_select', 'dropdown', 'date', 'boolean', 'scale'))
);
--> statement-breakpoint
CREATE TABLE "form_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "form_templates_id_workspace_key" UNIQUE("id","workspace_id"),
	CONSTRAINT "form_templates_purpose_version_key" UNIQUE("workspace_id","purpose","version"),
	CONSTRAINT "form_templates_purpose_check" CHECK ("form_templates"."purpose" in ('intake', 'checkin')),
	CONSTRAINT "form_templates_version_check" CHECK ("form_templates"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "checkins" ADD COLUMN "template_id" uuid;--> statement-breakpoint
ALTER TABLE "intake_responses" ADD COLUMN "template_id" uuid;--> statement-breakpoint
ALTER TABLE "form_questions" ADD CONSTRAINT "form_questions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_questions" ADD CONSTRAINT "form_questions_template_workspace_fk" FOREIGN KEY ("template_id","workspace_id") REFERENCES "public"."form_templates"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_templates" ADD CONSTRAINT "form_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "form_templates_one_active_idx" ON "form_templates" USING btree ("workspace_id","purpose") WHERE "form_templates"."is_active";--> statement-breakpoint
CREATE INDEX "form_templates_workspace_id_idx" ON "form_templates" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_template_id_form_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."form_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_responses" ADD CONSTRAINT "intake_responses_template_id_form_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."form_templates"("id") ON DELETE no action ON UPDATE no action;