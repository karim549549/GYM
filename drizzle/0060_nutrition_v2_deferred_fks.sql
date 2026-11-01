-- A workspace is deleted along two cascade paths at once: its foods, and its recipes with their
-- ingredients (and its meal plans with their items). A plain NO ACTION foreign key is checked when its own
-- row goes, and can run before the other path has removed the rows that point at it, which refuses a
-- delete that should succeed. Deferring the check to commit keeps the rule (a food or recipe that is still
-- used cannot be removed on its own) and lets the whole cascade finish first.
ALTER TABLE "recipe_ingredients" DROP CONSTRAINT "recipe_ingredients_food_id_foods_id_fk";--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "meal_items" DROP CONSTRAINT "meal_items_recipe_id_recipes_id_fk";--> statement-breakpoint
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "meal_item_subs" DROP CONSTRAINT "meal_item_subs_recipe_id_recipes_id_fk";--> statement-breakpoint
ALTER TABLE "meal_item_subs" ADD CONSTRAINT "meal_item_subs_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
