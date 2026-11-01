ALTER TABLE "food_units" RENAME TO "food_portions";
--> statement-breakpoint
ALTER TABLE "foods" RENAME COLUMN "kcal_100g" TO "calories_kcal_per_100g";
--> statement-breakpoint
ALTER TABLE "foods" RENAME COLUMN "protein_100g" TO "protein_g_per_100g";
--> statement-breakpoint
ALTER TABLE "foods" RENAME COLUMN "carb_100g" TO "carbs_g_per_100g";
--> statement-breakpoint
ALTER TABLE "foods" RENAME COLUMN "fat_100g" TO "fat_g_per_100g";
--> statement-breakpoint
ALTER TABLE "foods" RENAME COLUMN "fiber_100g" TO "fiber_g_per_100g";
--> statement-breakpoint
ALTER TABLE "foods" RENAME COLUMN "source" TO "origin_note";
--> statement-breakpoint
ALTER TABLE "food_portions" RENAME COLUMN "label_ar" TO "name_ar";
--> statement-breakpoint
ALTER TABLE "food_portions" RENAME COLUMN "grams" TO "weight_g";
--> statement-breakpoint
ALTER TABLE "food_portions" RENAME COLUMN "position" TO "sort_order";
--> statement-breakpoint
ALTER TABLE "meals" RENAME COLUMN "day_no" TO "weekday";
--> statement-breakpoint
ALTER TABLE "meals" RENAME COLUMN "time_hint" TO "suggested_time";
--> statement-breakpoint
ALTER TABLE "meals" RENAME COLUMN "position" TO "sort_order";
--> statement-breakpoint
ALTER TABLE "meal_items" RENAME COLUMN "food_name" TO "item_name";
--> statement-breakpoint
ALTER TABLE "meal_items" RENAME COLUMN "position" TO "sort_order";
--> statement-breakpoint
ALTER TABLE "meal_items" RENAME COLUMN "grams" TO "weight_g";
--> statement-breakpoint
ALTER TABLE "meal_items" RENAME COLUMN "unit_id" TO "portion_id";
--> statement-breakpoint
ALTER TABLE "meal_items" RENAME COLUMN "kcal" TO "calories_kcal";
--> statement-breakpoint
ALTER TABLE "meal_items" RENAME COLUMN "carb_g" TO "carbs_g";
--> statement-breakpoint
ALTER TABLE "meal_item_subs" RENAME COLUMN "food_name" TO "item_name";
--> statement-breakpoint
ALTER TABLE "meal_item_subs" RENAME COLUMN "position" TO "sort_order";
--> statement-breakpoint
ALTER TABLE "meal_item_subs" RENAME COLUMN "grams" TO "weight_g";
--> statement-breakpoint
ALTER TABLE "meal_item_subs" RENAME COLUMN "unit_id" TO "portion_id";
--> statement-breakpoint
ALTER TABLE "meal_item_subs" RENAME COLUMN "kcal" TO "calories_kcal";
--> statement-breakpoint
ALTER TABLE "meal_item_subs" RENAME COLUMN "carb_g" TO "carbs_g";
--> statement-breakpoint
ALTER TABLE "meal_plans" RENAME COLUMN "kcal_target" TO "calories_kcal_target";
--> statement-breakpoint
ALTER TABLE "meal_plans" RENAME COLUMN "protein_target_g" TO "protein_g_target";
--> statement-breakpoint
ALTER TABLE "meal_plans" RENAME COLUMN "carb_target_g" TO "carbs_g_target";
--> statement-breakpoint
ALTER TABLE "meal_plans" RENAME COLUMN "fat_target_g" TO "fat_g_target";
--> statement-breakpoint
ALTER TABLE "food_portions" RENAME CONSTRAINT "food_units_pkey" TO "food_portions_pkey";
--> statement-breakpoint
ALTER TABLE "food_portions" RENAME CONSTRAINT "food_units_food_workspace_fk" TO "food_portions_food_workspace_fk";
--> statement-breakpoint
ALTER TABLE "food_portions" RENAME CONSTRAINT "food_units_grams_check" TO "food_portions_weight_g_check";
--> statement-breakpoint
ALTER INDEX "food_units_one_default_idx" RENAME TO "food_portions_one_default_idx";
--> statement-breakpoint
ALTER INDEX "food_units_food_idx" RENAME TO "food_portions_food_idx";
--> statement-breakpoint
ALTER POLICY "food_units_read" ON "food_portions" RENAME TO "food_portions_read";
--> statement-breakpoint
ALTER POLICY "food_units_insert" ON "food_portions" RENAME TO "food_portions_insert";
--> statement-breakpoint
ALTER POLICY "food_units_update" ON "food_portions" RENAME TO "food_portions_update";
--> statement-breakpoint
ALTER POLICY "food_units_delete" ON "food_portions" RENAME TO "food_portions_delete";
--> statement-breakpoint
ALTER TABLE "meal_items" RENAME CONSTRAINT "meal_items_meal_position_key" TO "meal_items_meal_sort_order_key";
--> statement-breakpoint
ALTER TABLE "meal_item_subs" RENAME CONSTRAINT "meal_item_subs_item_position_key" TO "meal_item_subs_item_sort_order_key";
--> statement-breakpoint
ALTER TABLE "meals" DROP CONSTRAINT "meals_day_no_check";
--> statement-breakpoint
ALTER TABLE "meals" DROP CONSTRAINT "meals_plan_day_position_key";
--> statement-breakpoint
ALTER TABLE "meals" ALTER COLUMN "weekday" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "meals" ALTER COLUMN "weekday" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "meals" NO FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
UPDATE "meals" SET "weekday" = NULL WHERE "weekday" = 0;
--> statement-breakpoint
ALTER TABLE "meals" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_weekday_check" CHECK ("weekday" BETWEEN 1 AND 7);
--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_plan_weekday_sort_order_key" UNIQUE NULLS NOT DISTINCT ("meal_plan_id", "weekday", "sort_order");
--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "brand" text;
--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "barcode" text;
--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "search_name" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "description_ar" text;
--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "state" text;
--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "origin" text DEFAULT 'estimate' NOT NULL;
--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "confidence" text;
--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "review_flags" text[] DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "usda_fdc_id" integer;
--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "entry_basis" text DEFAULT 'per_100g' NOT NULL;
--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "entered_serving_weight_g" numeric;
--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "is_verified" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_barcode_check" CHECK ("foods"."barcode" ~ '^[0-9]{8,14}$');
--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_entry_serving_check" CHECK (("foods"."entry_basis" <> 'per_serving' or "foods"."entered_serving_weight_g" is not null) and ("foods"."entered_serving_weight_g" is null or "foods"."entered_serving_weight_g" > 0));
--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_verified_shared_check" CHECK (not "foods"."is_verified" or "foods"."workspace_id" is null);
--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_state_check" CHECK ("foods"."state" in ('raw', 'cooked', 'ready_to_eat', 'dry'));
--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_origin_check" CHECK ("foods"."origin" in ('seed', 'package_label', 'estimate', 'calculated'));
--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_confidence_check" CHECK ("foods"."confidence" in ('high', 'medium', 'low'));
--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_entry_basis_check" CHECK ("foods"."entry_basis" in ('per_100g', 'per_serving'));
--> statement-breakpoint
ALTER TABLE "meals" ADD COLUMN "category" text;
--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_category_check" CHECK ("meals"."category" in ('breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout'));

--> statement-breakpoint
CREATE UNIQUE INDEX "foods_shared_barcode_idx" ON "foods" ("barcode") WHERE "workspace_id" IS NULL;
