CREATE TABLE "food_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"food_id" uuid NOT NULL,
	"label_ar" text NOT NULL,
	"grams" numeric(7, 2) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "food_units_grams_check" CHECK ("food_units"."grams" > 0)
);
--> statement-breakpoint
CREATE TABLE "foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"name_ar" text NOT NULL,
	"name_en" text,
	"slug" text,
	"category" text NOT NULL,
	"kcal_100g" numeric(7, 2) NOT NULL,
	"protein_100g" numeric(6, 2) NOT NULL,
	"carb_100g" numeric(6, 2) NOT NULL,
	"fat_100g" numeric(6, 2) NOT NULL,
	"fiber_100g" numeric(6, 2) DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "foods_id_workspace_key" UNIQUE("id","workspace_id"),
	CONSTRAINT "foods_category_check" CHECK ("foods"."category" in ('protein', 'carb', 'fat', 'vegetable', 'fruit', 'dairy', 'drink', 'composite', 'supplement')),
	CONSTRAINT "foods_macros_check" CHECK ("foods"."kcal_100g" >= 0 and "foods"."protein_100g" >= 0 and "foods"."carb_100g" >= 0 and "foods"."fat_100g" >= 0 and "foods"."fiber_100g" >= 0)
);
--> statement-breakpoint
CREATE TABLE "meal_item_subs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"meal_item_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"food_id" uuid NOT NULL,
	"quantity" numeric(7, 2) NOT NULL,
	"unit_id" uuid,
	"grams" numeric(7, 2) NOT NULL,
	"food_name" text NOT NULL,
	"kcal" numeric(7, 2) NOT NULL,
	"protein_g" numeric(6, 2) NOT NULL,
	"carb_g" numeric(6, 2) NOT NULL,
	"fat_g" numeric(6, 2) NOT NULL,
	CONSTRAINT "meal_item_subs_item_position_key" UNIQUE("meal_item_id","position")
);
--> statement-breakpoint
CREATE TABLE "meal_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"meal_id" uuid NOT NULL,
	"food_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"quantity" numeric(7, 2) NOT NULL,
	"unit_id" uuid,
	"grams" numeric(7, 2) NOT NULL,
	"food_name" text NOT NULL,
	"kcal" numeric(7, 2) NOT NULL,
	"protein_g" numeric(6, 2) NOT NULL,
	"carb_g" numeric(6, 2) NOT NULL,
	"fat_g" numeric(6, 2) NOT NULL,
	CONSTRAINT "meal_items_meal_position_key" UNIQUE("meal_id","position"),
	CONSTRAINT "meal_items_id_workspace_key" UNIQUE("id","workspace_id"),
	CONSTRAINT "meal_items_quantity_check" CHECK ("meal_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "meal_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid,
	"is_template" boolean DEFAULT false NOT NULL,
	"name" text NOT NULL,
	"kcal_target" integer,
	"protein_target_g" integer,
	"carb_target_g" integer,
	"fat_target_g" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"starts_on" date,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meal_plans_id_workspace_key" UNIQUE("id","workspace_id"),
	CONSTRAINT "meal_plans_status_check" CHECK ("meal_plans"."status" in ('draft', 'active', 'ended')),
	CONSTRAINT "meal_plans_template_or_client_check" CHECK (("meal_plans"."is_template" and "meal_plans"."client_id" is null) or (not "meal_plans"."is_template" and "meal_plans"."client_id" is not null)),
	CONSTRAINT "meal_plans_targets_check" CHECK (coalesce("meal_plans"."kcal_target", 0) >= 0 and coalesce("meal_plans"."protein_target_g", 0) >= 0 and coalesce("meal_plans"."carb_target_g", 0) >= 0 and coalesce("meal_plans"."fat_target_g", 0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"meal_plan_id" uuid NOT NULL,
	"day_no" integer DEFAULT 0 NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"time_hint" time,
	"notes" text,
	CONSTRAINT "meals_plan_day_position_key" UNIQUE("meal_plan_id","day_no","position"),
	CONSTRAINT "meals_id_workspace_key" UNIQUE("id","workspace_id"),
	CONSTRAINT "meals_day_no_check" CHECK ("meals"."day_no" between 0 and 7)
);
--> statement-breakpoint
ALTER TABLE "food_units" ADD CONSTRAINT "food_units_food_workspace_fk" FOREIGN KEY ("food_id","workspace_id") REFERENCES "public"."foods"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_item_subs" ADD CONSTRAINT "meal_item_subs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_item_subs" ADD CONSTRAINT "meal_item_subs_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_item_subs" ADD CONSTRAINT "meal_item_subs_unit_id_food_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."food_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_item_subs" ADD CONSTRAINT "meal_item_subs_item_workspace_fk" FOREIGN KEY ("meal_item_id","workspace_id") REFERENCES "public"."meal_items"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_unit_id_food_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."food_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_meal_workspace_fk" FOREIGN KEY ("meal_id","workspace_id") REFERENCES "public"."meals"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_created_by_people_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_client_workspace_fk" FOREIGN KEY ("client_id","workspace_id") REFERENCES "public"."clients"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_plan_workspace_fk" FOREIGN KEY ("meal_plan_id","workspace_id") REFERENCES "public"."meal_plans"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "food_units_one_default_idx" ON "food_units" USING btree ("food_id") WHERE "food_units"."is_default";--> statement-breakpoint
CREATE INDEX "food_units_food_idx" ON "food_units" USING btree ("food_id");--> statement-breakpoint
CREATE UNIQUE INDEX "foods_global_slug_idx" ON "foods" USING btree ("slug") WHERE "foods"."workspace_id" is null;--> statement-breakpoint
CREATE INDEX "foods_workspace_id_idx" ON "foods" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "meal_item_subs_food_idx" ON "meal_item_subs" USING btree ("food_id");--> statement-breakpoint
CREATE INDEX "meal_items_food_idx" ON "meal_items" USING btree ("food_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_plans_one_active_per_client_idx" ON "meal_plans" USING btree ("client_id") WHERE "meal_plans"."status" = 'active' and "meal_plans"."client_id" is not null;--> statement-breakpoint
CREATE INDEX "meal_plans_workspace_id_idx" ON "meal_plans" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "meal_plans_client_id_idx" ON "meal_plans" USING btree ("client_id");