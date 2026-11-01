ALTER TABLE "nutrients" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "nutrients" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "nutrients_read" ON "nutrients" FOR SELECT USING (true);
--> statement-breakpoint
ALTER TABLE "food_nutrients" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "food_nutrients" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "food_nutrients_read" ON "food_nutrients" FOR SELECT USING ("workspace_id" IS NULL OR "workspace_id" = app_workspace_id());
--> statement-breakpoint
CREATE POLICY "food_nutrients_insert" ON "food_nutrients" FOR INSERT WITH CHECK ("workspace_id" = app_workspace_id());
--> statement-breakpoint
CREATE POLICY "food_nutrients_update" ON "food_nutrients" FOR UPDATE USING ("workspace_id" = app_workspace_id()) WITH CHECK ("workspace_id" = app_workspace_id());
--> statement-breakpoint
CREATE POLICY "food_nutrients_delete" ON "food_nutrients" FOR DELETE USING ("workspace_id" = app_workspace_id());
--> statement-breakpoint
ALTER TABLE "food_aliases" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "food_aliases" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "food_aliases_read" ON "food_aliases" FOR SELECT USING ("workspace_id" IS NULL OR "workspace_id" = app_workspace_id());
--> statement-breakpoint
CREATE POLICY "food_aliases_insert" ON "food_aliases" FOR INSERT WITH CHECK ("workspace_id" = app_workspace_id());
--> statement-breakpoint
CREATE POLICY "food_aliases_update" ON "food_aliases" FOR UPDATE USING ("workspace_id" = app_workspace_id()) WITH CHECK ("workspace_id" = app_workspace_id());
--> statement-breakpoint
CREATE POLICY "food_aliases_delete" ON "food_aliases" FOR DELETE USING ("workspace_id" = app_workspace_id());
--> statement-breakpoint
ALTER TABLE "food_publication_requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "food_publication_requests" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "food_publication_requests_read" ON "food_publication_requests" FOR SELECT USING ("workspace_id" = app_workspace_id());
--> statement-breakpoint
CREATE POLICY "food_publication_requests_insert" ON "food_publication_requests" FOR INSERT WITH CHECK ("workspace_id" = app_workspace_id() AND "status" = 'pending' AND "duplicate_of_food_id" IS NULL AND "reviewer_note" IS NULL AND "reviewed_by" IS NULL AND "reviewed_at" IS NULL);
--> statement-breakpoint
CREATE POLICY "food_publication_requests_system_read" ON "food_publication_requests" FOR SELECT USING (app_is_system());
--> statement-breakpoint
CREATE POLICY "food_publication_requests_system_update" ON "food_publication_requests" FOR UPDATE USING (app_is_system()) WITH CHECK (app_is_system());
--> statement-breakpoint
ALTER TABLE "recipes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "recipes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "recipes_read" ON "recipes" FOR SELECT USING ("workspace_id" IS NULL OR "workspace_id" = app_workspace_id());
--> statement-breakpoint
CREATE POLICY "recipes_insert" ON "recipes" FOR INSERT WITH CHECK ("workspace_id" = app_workspace_id());
--> statement-breakpoint
CREATE POLICY "recipes_update" ON "recipes" FOR UPDATE USING ("workspace_id" = app_workspace_id()) WITH CHECK ("workspace_id" = app_workspace_id());
--> statement-breakpoint
CREATE POLICY "recipes_delete" ON "recipes" FOR DELETE USING ("workspace_id" = app_workspace_id());
--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "recipe_ingredients" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "recipe_ingredients_read" ON "recipe_ingredients" FOR SELECT USING ("workspace_id" IS NULL OR "workspace_id" = app_workspace_id());
--> statement-breakpoint
CREATE POLICY "recipe_ingredients_insert" ON "recipe_ingredients" FOR INSERT WITH CHECK ("workspace_id" = app_workspace_id() AND EXISTS (SELECT 1 FROM foods f WHERE f.id = recipe_ingredients.food_id));
--> statement-breakpoint
CREATE POLICY "recipe_ingredients_update" ON "recipe_ingredients" FOR UPDATE USING ("workspace_id" = app_workspace_id()) WITH CHECK ("workspace_id" = app_workspace_id() AND EXISTS (SELECT 1 FROM foods f WHERE f.id = recipe_ingredients.food_id));
--> statement-breakpoint
CREATE POLICY "recipe_ingredients_delete" ON "recipe_ingredients" FOR DELETE USING ("workspace_id" = app_workspace_id());
--> statement-breakpoint
ALTER TABLE "recipe_steps" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "recipe_steps" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "recipe_steps_read" ON "recipe_steps" FOR SELECT USING ("workspace_id" IS NULL OR "workspace_id" = app_workspace_id());
--> statement-breakpoint
CREATE POLICY "recipe_steps_insert" ON "recipe_steps" FOR INSERT WITH CHECK ("workspace_id" = app_workspace_id());
--> statement-breakpoint
CREATE POLICY "recipe_steps_update" ON "recipe_steps" FOR UPDATE USING ("workspace_id" = app_workspace_id()) WITH CHECK ("workspace_id" = app_workspace_id());
--> statement-breakpoint
CREATE POLICY "recipe_steps_delete" ON "recipe_steps" FOR DELETE USING ("workspace_id" = app_workspace_id());
--> statement-breakpoint
ALTER TABLE "recipe_portions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "recipe_portions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "recipe_portions_read" ON "recipe_portions" FOR SELECT USING ("workspace_id" IS NULL OR "workspace_id" = app_workspace_id());
--> statement-breakpoint
CREATE POLICY "recipe_portions_insert" ON "recipe_portions" FOR INSERT WITH CHECK ("workspace_id" = app_workspace_id());
--> statement-breakpoint
CREATE POLICY "recipe_portions_update" ON "recipe_portions" FOR UPDATE USING ("workspace_id" = app_workspace_id()) WITH CHECK ("workspace_id" = app_workspace_id());
--> statement-breakpoint
CREATE POLICY "recipe_portions_delete" ON "recipe_portions" FOR DELETE USING ("workspace_id" = app_workspace_id());
--> statement-breakpoint
ALTER TABLE "recipe_aliases" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "recipe_aliases" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "recipe_aliases_read" ON "recipe_aliases" FOR SELECT USING ("workspace_id" IS NULL OR "workspace_id" = app_workspace_id());
--> statement-breakpoint
CREATE POLICY "recipe_aliases_insert" ON "recipe_aliases" FOR INSERT WITH CHECK ("workspace_id" = app_workspace_id());
--> statement-breakpoint
CREATE POLICY "recipe_aliases_update" ON "recipe_aliases" FOR UPDATE USING ("workspace_id" = app_workspace_id()) WITH CHECK ("workspace_id" = app_workspace_id());
--> statement-breakpoint
CREATE POLICY "recipe_aliases_delete" ON "recipe_aliases" FOR DELETE USING ("workspace_id" = app_workspace_id());

--> statement-breakpoint
ALTER POLICY "meal_items_tenant" ON "meal_items" WITH CHECK ("workspace_id" = app_workspace_id() AND ((meal_items.food_id IS NULL OR EXISTS (SELECT 1 FROM foods f WHERE f.id = meal_items.food_id)) AND (meal_items.recipe_id IS NULL OR EXISTS (SELECT 1 FROM recipes r WHERE r.id = meal_items.recipe_id))));

--> statement-breakpoint
ALTER POLICY "meal_item_subs_tenant" ON "meal_item_subs" WITH CHECK ("workspace_id" = app_workspace_id() AND ((meal_item_subs.food_id IS NULL OR EXISTS (SELECT 1 FROM foods f WHERE f.id = meal_item_subs.food_id)) AND (meal_item_subs.recipe_id IS NULL OR EXISTS (SELECT 1 FROM recipes r WHERE r.id = meal_item_subs.recipe_id))));
