CREATE TABLE "food_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"food_id" uuid NOT NULL,
	"workspace_id" uuid,
	"kind" text NOT NULL,
	"alias" text NOT NULL,
	"search_alias" text DEFAULT '' NOT NULL,
	CONSTRAINT "food_aliases_food_kind_search_key" UNIQUE("food_id","kind","search_alias"),
	CONSTRAINT "food_aliases_kind_check" CHECK ("food_aliases"."kind" in ('alias_ar', 'alias_en', 'search_hint'))
);
--> statement-breakpoint
CREATE TABLE "food_nutrients" (
	"food_id" uuid NOT NULL,
	"workspace_id" uuid,
	"nutrient_id" uuid NOT NULL,
	"amount_per_100g" numeric NOT NULL,
	CONSTRAINT "food_nutrients_food_id_nutrient_id_pk" PRIMARY KEY("food_id","nutrient_id"),
	CONSTRAINT "food_nutrients_amount_check" CHECK ("food_nutrients"."amount_per_100g" >= 0)
);
--> statement-breakpoint
CREATE TABLE "food_publication_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"food_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"duplicate_of_food_id" uuid,
	"reviewer_note" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "food_publication_requests_status_check" CHECK ("food_publication_requests"."status" in ('pending', 'approved', 'rejected', 'duplicate'))
);
--> statement-breakpoint
CREATE TABLE "nutrients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"measure_unit" text NOT NULL,
	"appears_on_package_label" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "nutrients_code_unique" UNIQUE("code"),
	CONSTRAINT "nutrients_code_check" CHECK ("nutrients"."code" ~ '^[a-z]+(_[a-z]+)*$'),
	CONSTRAINT "nutrients_measure_unit_check" CHECK ("nutrients"."measure_unit" in ('g', 'mg', 'mcg'))
);
--> statement-breakpoint
CREATE TABLE "recipe_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"recipe_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"alias" text NOT NULL,
	"search_alias" text DEFAULT '' NOT NULL,
	CONSTRAINT "recipe_aliases_recipe_kind_search_key" UNIQUE("recipe_id","kind","search_alias"),
	CONSTRAINT "recipe_aliases_kind_check" CHECK ("recipe_aliases"."kind" in ('alias_ar', 'alias_en', 'search_hint'))
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"recipe_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"food_id" uuid NOT NULL,
	"weight_g" numeric NOT NULL,
	"note_ar" text,
	CONSTRAINT "recipe_ingredients_recipe_sort_order_key" UNIQUE("recipe_id","sort_order"),
	CONSTRAINT "recipe_ingredients_weight_g_check" CHECK ("recipe_ingredients"."weight_g" > 0)
);
--> statement-breakpoint
CREATE TABLE "recipe_portions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"recipe_id" uuid NOT NULL,
	"name_ar" text NOT NULL,
	"weight_g" numeric NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "recipe_portions_id_recipe_key" UNIQUE("id","recipe_id"),
	CONSTRAINT "recipe_portions_weight_g_check" CHECK ("recipe_portions"."weight_g" > 0)
);
--> statement-breakpoint
CREATE TABLE "recipe_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"recipe_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"instruction" text NOT NULL,
	CONSTRAINT "recipe_steps_recipe_sort_order_key" UNIQUE("recipe_id","sort_order")
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"name_ar" text NOT NULL,
	"name_en" text,
	"search_name" text DEFAULT '' NOT NULL,
	"description_ar" text,
	"finished_weight_g" numeric NOT NULL,
	"prep_minutes" integer,
	"cook_minutes" integer,
	"youtube_video_id" text,
	"copied_from_recipe_id" uuid,
	"calories_kcal_per_100g" numeric(7, 2) NOT NULL,
	"protein_g_per_100g" numeric(7, 2) NOT NULL,
	"carbs_g_per_100g" numeric(7, 2) NOT NULL,
	"fat_g_per_100g" numeric(7, 2) NOT NULL,
	"fiber_g_per_100g" numeric(7, 2) NOT NULL,
	"meal_tags" text[] DEFAULT '{}' NOT NULL,
	"origin" text NOT NULL,
	"origin_note" text,
	"confidence" text,
	"review_flags" text[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipes_id_workspace_key" UNIQUE("id","workspace_id"),
	CONSTRAINT "recipes_finished_weight_check" CHECK ("recipes"."finished_weight_g" > 0),
	CONSTRAINT "recipes_minutes_check" CHECK ("recipes"."prep_minutes" >= 0 and "recipes"."cook_minutes" >= 0),
	CONSTRAINT "recipes_youtube_video_id_check" CHECK ("recipes"."youtube_video_id" ~ '^[A-Za-z0-9_-]{11}$'),
	CONSTRAINT "recipes_macros_check" CHECK ("recipes"."calories_kcal_per_100g" >= 0 and "recipes"."protein_g_per_100g" >= 0 and "recipes"."carbs_g_per_100g" >= 0 and "recipes"."fat_g_per_100g" >= 0 and "recipes"."fiber_g_per_100g" >= 0),
	CONSTRAINT "recipes_meal_tags_check" CHECK ("recipes"."meal_tags" <@ ARRAY['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout']::text[]),
	CONSTRAINT "recipes_origin_check" CHECK ("recipes"."origin" in ('seed', 'user')),
	CONSTRAINT "recipes_confidence_check" CHECK ("recipes"."confidence" in ('high', 'medium', 'low'))
);
--> statement-breakpoint
ALTER TABLE "food_aliases" ADD CONSTRAINT "food_aliases_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "food_aliases" ADD CONSTRAINT "food_aliases_food_workspace_fk" FOREIGN KEY ("food_id","workspace_id") REFERENCES "public"."foods"("id","workspace_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "food_nutrients" ADD CONSTRAINT "food_nutrients_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "food_nutrients" ADD CONSTRAINT "food_nutrients_nutrient_id_nutrients_id_fk" FOREIGN KEY ("nutrient_id") REFERENCES "public"."nutrients"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "food_nutrients" ADD CONSTRAINT "food_nutrients_food_workspace_fk" FOREIGN KEY ("food_id","workspace_id") REFERENCES "public"."foods"("id","workspace_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "food_publication_requests" ADD CONSTRAINT "food_publication_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "food_publication_requests" ADD CONSTRAINT "food_publication_requests_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "food_publication_requests" ADD CONSTRAINT "food_publication_requests_duplicate_of_food_id_foods_id_fk" FOREIGN KEY ("duplicate_of_food_id") REFERENCES "public"."foods"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "food_publication_requests" ADD CONSTRAINT "food_publication_requests_reviewed_by_people_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "food_publication_requests" ADD CONSTRAINT "food_publication_requests_food_workspace_fk" FOREIGN KEY ("food_id","workspace_id") REFERENCES "public"."foods"("id","workspace_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipe_aliases" ADD CONSTRAINT "recipe_aliases_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipe_aliases" ADD CONSTRAINT "recipe_aliases_recipe_workspace_fk" FOREIGN KEY ("recipe_id","workspace_id") REFERENCES "public"."recipes"("id","workspace_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_workspace_fk" FOREIGN KEY ("recipe_id","workspace_id") REFERENCES "public"."recipes"("id","workspace_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipe_portions" ADD CONSTRAINT "recipe_portions_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipe_portions" ADD CONSTRAINT "recipe_portions_recipe_workspace_fk" FOREIGN KEY ("recipe_id","workspace_id") REFERENCES "public"."recipes"("id","workspace_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_recipe_workspace_fk" FOREIGN KEY ("recipe_id","workspace_id") REFERENCES "public"."recipes"("id","workspace_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_copied_from_recipe_id_recipes_id_fk" FOREIGN KEY ("copied_from_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "food_publication_requests_one_pending_idx" ON "food_publication_requests" USING btree ("food_id") WHERE "food_publication_requests"."status" = 'pending';
--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_portions_one_default_idx" ON "recipe_portions" USING btree ("recipe_id") WHERE "recipe_portions"."is_default";
--> statement-breakpoint
ALTER TABLE "food_portions" ADD CONSTRAINT "food_portions_id_food_key" UNIQUE ("id", "food_id");
--> statement-breakpoint
ALTER TABLE "food_portions" ADD CONSTRAINT "food_portions_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "meal_items" DROP CONSTRAINT "meal_items_unit_id_food_units_id_fk";
--> statement-breakpoint
ALTER TABLE "meal_items" ALTER COLUMN "food_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "meal_items" ADD COLUMN "recipe_id" uuid;
--> statement-breakpoint
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_food_or_recipe_check" CHECK (num_nonnulls("meal_items"."food_id", "meal_items"."recipe_id") = 1);
--> statement-breakpoint
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_portion_food_fk" FOREIGN KEY ("portion_id","food_id") REFERENCES "public"."food_portions"("id","food_id") ON DELETE SET NULL ("portion_id") ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_portion_recipe_fk" FOREIGN KEY ("portion_id","recipe_id") REFERENCES "public"."recipe_portions"("id","recipe_id") ON DELETE SET NULL ("portion_id") ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "meal_item_subs" DROP CONSTRAINT "meal_item_subs_unit_id_food_units_id_fk";
--> statement-breakpoint
ALTER TABLE "meal_item_subs" ALTER COLUMN "food_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "meal_item_subs" ADD COLUMN "recipe_id" uuid;
--> statement-breakpoint
ALTER TABLE "meal_item_subs" ADD CONSTRAINT "meal_item_subs_food_or_recipe_check" CHECK (num_nonnulls("meal_item_subs"."food_id", "meal_item_subs"."recipe_id") = 1);
--> statement-breakpoint
ALTER TABLE "meal_item_subs" ADD CONSTRAINT "meal_item_subs_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "meal_item_subs" ADD CONSTRAINT "meal_item_subs_portion_food_fk" FOREIGN KEY ("portion_id","food_id") REFERENCES "public"."food_portions"("id","food_id") ON DELETE SET NULL ("portion_id") ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "meal_item_subs" ADD CONSTRAINT "meal_item_subs_portion_recipe_fk" FOREIGN KEY ("portion_id","recipe_id") REFERENCES "public"."recipe_portions"("id","recipe_id") ON DELETE SET NULL ("portion_id") ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "nutrients" ("code", "name_ar", "name_en", "measure_unit", "appears_on_package_label", "sort_order") VALUES
('sugars', 'سكريات', 'Sugars', 'g', true, 1),
('saturated_fat', 'دهون مشبعة', 'Saturated fat', 'g', true, 2),
('sodium', 'صوديوم', 'Sodium', 'mg', true, 3),
('calcium', 'كالسيوم', 'Calcium', 'mg', false, 4),
('iron', 'حديد', 'Iron', 'mg', false, 5),
('potassium', 'بوتاسيوم', 'Potassium', 'mg', false, 6),
('vitamin_c', 'فيتامين ج', 'Vitamin C', 'mg', false, 7);
