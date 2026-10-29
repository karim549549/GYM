CREATE TABLE "exercise_muscles" (
	"exercise_id" uuid NOT NULL,
	"workspace_id" uuid,
	"muscle_id" text NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "exercise_muscles_exercise_id_muscle_id_pk" PRIMARY KEY("exercise_id","muscle_id"),
	CONSTRAINT "exercise_muscles_role_check" CHECK ("exercise_muscles"."role" in ('primary', 'secondary'))
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"slug" text,
	"equipment" text[] DEFAULT '{}' NOT NULL,
	"difficulty" text DEFAULT 'beginner' NOT NULL,
	"pattern" text,
	"cues" text[] DEFAULT '{}' NOT NULL,
	"mistakes" text[] DEFAULT '{}' NOT NULL,
	"video_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercises_id_workspace_key" UNIQUE("id","workspace_id"),
	CONSTRAINT "exercises_difficulty_check" CHECK ("exercises"."difficulty" in ('beginner', 'intermediate', 'advanced')),
	CONSTRAINT "exercises_pattern_check" CHECK ("exercises"."pattern" is null or "exercises"."pattern" in ('push', 'pull', 'legs', 'core', 'cardio'))
);
--> statement-breakpoint
CREATE TABLE "muscles" (
	"id" text PRIMARY KEY NOT NULL,
	"label_ar" text NOT NULL,
	"label_en" text NOT NULL,
	"svg_path_id" text NOT NULL,
	"body_side" text NOT NULL,
	CONSTRAINT "muscles_body_side_check" CHECK ("muscles"."body_side" in ('front', 'back', 'both'))
);
--> statement-breakpoint
ALTER TABLE "exercise_muscles" ADD CONSTRAINT "exercise_muscles_muscle_id_muscles_id_fk" FOREIGN KEY ("muscle_id") REFERENCES "public"."muscles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscles" ADD CONSTRAINT "exercise_muscles_exercise_workspace_fk" FOREIGN KEY ("exercise_id","workspace_id") REFERENCES "public"."exercises"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercise_muscles_muscle_idx" ON "exercise_muscles" USING btree ("muscle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_global_slug_idx" ON "exercises" USING btree ("slug") WHERE "exercises"."workspace_id" is null;--> statement-breakpoint
CREATE INDEX "exercises_workspace_id_idx" ON "exercises" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "exercises_equipment_idx" ON "exercises" USING gin ("equipment");