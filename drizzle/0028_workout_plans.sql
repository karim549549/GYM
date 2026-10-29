CREATE TABLE "plan_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"week_no" integer NOT NULL,
	"day_no" integer NOT NULL,
	"name" text,
	"is_rest" boolean DEFAULT false NOT NULL,
	"is_deload" boolean DEFAULT false NOT NULL,
	"notes" text,
	CONSTRAINT "plan_days_plan_week_day_key" UNIQUE("plan_id","week_no","day_no"),
	CONSTRAINT "plan_days_id_workspace_key" UNIQUE("id","workspace_id"),
	CONSTRAINT "plan_days_week_no_check" CHECK ("plan_days"."week_no" > 0),
	CONSTRAINT "plan_days_day_no_check" CHECK ("plan_days"."day_no" between 1 and 7)
);
--> statement-breakpoint
CREATE TABLE "plan_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"plan_day_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"exercise_name" text NOT NULL,
	"coach_note" text,
	"superset_group" text,
	CONSTRAINT "plan_exercises_day_position_key" UNIQUE("plan_day_id","position"),
	CONSTRAINT "plan_exercises_id_workspace_key" UNIQUE("id","workspace_id")
);
--> statement-breakpoint
CREATE TABLE "plan_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"plan_exercise_id" uuid NOT NULL,
	"set_no" integer NOT NULL,
	"reps" text,
	"weight_kg" numeric(6, 2),
	"weight_pct" numeric(5, 2),
	"rest_seconds" integer,
	"rir" numeric(3, 1),
	CONSTRAINT "plan_sets_exercise_set_key" UNIQUE("plan_exercise_id","set_no"),
	CONSTRAINT "plan_sets_weight_kg_check" CHECK ("plan_sets"."weight_kg" >= 0),
	CONSTRAINT "plan_sets_weight_pct_check" CHECK ("plan_sets"."weight_pct" between 0 and 200),
	CONSTRAINT "plan_sets_rest_check" CHECK ("plan_sets"."rest_seconds" between 0 and 3600),
	CONSTRAINT "plan_sets_rir_check" CHECK ("plan_sets"."rir" between 0 and 10)
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid,
	"is_template" boolean DEFAULT false NOT NULL,
	"name" text NOT NULL,
	"goal" text,
	"weeks" integer DEFAULT 4 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"starts_on" date,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_id_workspace_key" UNIQUE("id","workspace_id"),
	CONSTRAINT "plans_weeks_check" CHECK ("plans"."weeks" between 1 and 52),
	CONSTRAINT "plans_status_check" CHECK ("plans"."status" in ('draft', 'active', 'ended')),
	CONSTRAINT "plans_template_or_client_check" CHECK (("plans"."is_template" and "plans"."client_id" is null) or (not "plans"."is_template" and "plans"."client_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "plan_days" ADD CONSTRAINT "plan_days_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_days" ADD CONSTRAINT "plan_days_plan_workspace_fk" FOREIGN KEY ("plan_id","workspace_id") REFERENCES "public"."plans"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_exercises" ADD CONSTRAINT "plan_exercises_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_exercises" ADD CONSTRAINT "plan_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_exercises" ADD CONSTRAINT "plan_exercises_day_workspace_fk" FOREIGN KEY ("plan_day_id","workspace_id") REFERENCES "public"."plan_days"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_sets" ADD CONSTRAINT "plan_sets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_sets" ADD CONSTRAINT "plan_sets_exercise_workspace_fk" FOREIGN KEY ("plan_exercise_id","workspace_id") REFERENCES "public"."plan_exercises"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_created_by_people_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_client_workspace_fk" FOREIGN KEY ("client_id","workspace_id") REFERENCES "public"."clients"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_exercises_exercise_idx" ON "plan_exercises" USING btree ("exercise_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plans_one_active_per_client_idx" ON "plans" USING btree ("client_id") WHERE "plans"."status" = 'active' and "plans"."client_id" is not null;--> statement-breakpoint
CREATE INDEX "plans_workspace_id_idx" ON "plans" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "plans_client_id_idx" ON "plans" USING btree ("client_id");