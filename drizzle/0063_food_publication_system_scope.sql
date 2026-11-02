CREATE POLICY "foods_system_read" ON "foods" FOR SELECT USING (app_is_system());
--> statement-breakpoint
CREATE POLICY "foods_system_insert_shared" ON "foods" FOR INSERT WITH CHECK (app_is_system() AND "workspace_id" IS NULL);
--> statement-breakpoint
CREATE POLICY "food_portions_system_read" ON "food_portions" FOR SELECT USING (app_is_system());
--> statement-breakpoint
CREATE POLICY "food_portions_system_insert_shared" ON "food_portions" FOR INSERT WITH CHECK (app_is_system() AND "workspace_id" IS NULL);
--> statement-breakpoint
CREATE POLICY "food_nutrients_system_read" ON "food_nutrients" FOR SELECT USING (app_is_system());
--> statement-breakpoint
CREATE POLICY "food_nutrients_system_insert_shared" ON "food_nutrients" FOR INSERT WITH CHECK (app_is_system() AND "workspace_id" IS NULL);
--> statement-breakpoint
CREATE POLICY "food_aliases_system_read" ON "food_aliases" FOR SELECT USING (app_is_system());
--> statement-breakpoint
CREATE POLICY "food_aliases_system_insert_shared" ON "food_aliases" FOR INSERT WITH CHECK (app_is_system() AND "workspace_id" IS NULL);
