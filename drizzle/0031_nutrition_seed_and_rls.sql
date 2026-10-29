-- The library's own foods and their units. They are global (no workspace), so they are inserted
-- before row level security is turned on below: once it is, only a workspace's own foods can be
-- written through the application. Macros are per 100 g and tagged 'estimate_v1': rounded from
-- published composition tables, good enough to build with and still to be verified by a nutritionist.
INSERT INTO "foods" ("slug", "name_ar", "name_en", "category", "kcal_100g", "protein_100g", "carb_100g", "fat_100g", "fiber_100g", "source") VALUES
  ('chicken-breast-grilled', 'صدر فراخ مشوي', 'Grilled chicken breast', 'protein', 165, 31, 0, 3.6, 0, 'estimate_v1'),
  ('chicken-thigh-grilled', 'فخذ فراخ مشوي', 'Grilled chicken thigh', 'protein', 209, 26, 0, 11, 0, 'estimate_v1'),
  ('beef-lean-cooked', 'لحم بقري مطبوخ', 'Lean beef, cooked', 'protein', 250, 26, 0, 15, 0, 'estimate_v1'),
  ('kofta-grilled', 'كفتة مشوية', 'Grilled kofta', 'protein', 250, 20, 3, 18, 0.5, 'estimate_v1'),
  ('liver-beef-cooked', 'كبدة بقري', 'Beef liver, cooked', 'protein', 175, 27, 4, 5, 0, 'estimate_v1'),
  ('tuna-canned-water', 'تونة معلبة بالماء', 'Canned tuna in water', 'protein', 116, 26, 0, 1, 0, 'estimate_v1'),
  ('fish-grilled', 'سمك مشوي', 'Grilled fish', 'protein', 128, 26, 0, 2.7, 0, 'estimate_v1'),
  ('shrimp-cooked', 'جمبري مطبوخ', 'Cooked shrimp', 'protein', 99, 24, 0.2, 0.3, 0, 'estimate_v1'),
  ('turkey-breast', 'صدر رومي', 'Turkey breast', 'protein', 135, 30, 0, 1, 0, 'estimate_v1'),
  ('egg-boiled', 'بيضة مسلوقة', 'Boiled egg', 'protein', 155, 13, 1.1, 11, 0, 'estimate_v1'),
  ('egg-white', 'بياض بيض', 'Egg white', 'protein', 52, 11, 0.7, 0.2, 0, 'estimate_v1'),
  ('ful-medames', 'فول مدمس', 'Ful medames', 'protein', 110, 7.6, 19, 0.4, 5.4, 'estimate_v1'),
  ('lentils-cooked', 'عدس مطبوخ', 'Cooked lentils', 'protein', 116, 9, 20, 0.4, 7.9, 'estimate_v1'),
  ('chickpeas-cooked', 'حمص مطبوخ', 'Cooked chickpeas', 'protein', 164, 8.9, 27, 2.6, 7.6, 'estimate_v1'),
  ('rice-white-cooked', 'أرز أبيض مطبوخ', 'Cooked white rice', 'carb', 130, 2.7, 28, 0.3, 0.4, 'estimate_v1'),
  ('rice-brown-cooked', 'أرز بني مطبوخ', 'Cooked brown rice', 'carb', 112, 2.3, 23.5, 0.8, 1.8, 'estimate_v1'),
  ('bread-baladi', 'عيش بلدي', 'Baladi bread', 'carb', 270, 9, 55, 1.5, 5, 'estimate_v1'),
  ('bread-fino', 'عيش فينو', 'Fino bread', 'carb', 275, 9, 52, 3, 2, 'estimate_v1'),
  ('pasta-cooked', 'مكرونة مسلوقة', 'Cooked pasta', 'carb', 158, 5.8, 31, 0.9, 1.8, 'estimate_v1'),
  ('potato-boiled', 'بطاطس مسلوقة', 'Boiled potato', 'carb', 87, 1.9, 20, 0.1, 1.8, 'estimate_v1'),
  ('sweet-potato-baked', 'بطاطا مشوية', 'Baked sweet potato', 'carb', 90, 2, 21, 0.2, 3.3, 'estimate_v1'),
  ('oats-dry', 'شوفان', 'Oats', 'carb', 389, 17, 66, 7, 10.6, 'estimate_v1'),
  ('bulgur-cooked', 'برغل مطبوخ', 'Cooked bulgur', 'carb', 83, 3, 19, 0.2, 4.5, 'estimate_v1'),
  ('olive-oil', 'زيت زيتون', 'Olive oil', 'fat', 884, 0, 0, 100, 0, 'estimate_v1'),
  ('tahini', 'طحينة', 'Tahini', 'fat', 595, 17, 21, 54, 9, 'estimate_v1'),
  ('almonds', 'لوز', 'Almonds', 'fat', 579, 21, 22, 50, 12.5, 'estimate_v1'),
  ('walnuts', 'عين جمل', 'Walnuts', 'fat', 654, 15, 14, 65, 6.7, 'estimate_v1'),
  ('peanut-butter', 'زبدة فول سوداني', 'Peanut butter', 'fat', 588, 25, 20, 50, 6, 'estimate_v1'),
  ('avocado', 'أفوكادو', 'Avocado', 'fat', 160, 2, 8.5, 14.7, 6.7, 'estimate_v1'),
  ('ghee', 'سمن', 'Ghee', 'fat', 876, 0.3, 0, 99.5, 0, 'estimate_v1'),
  ('cucumber', 'خيار', 'Cucumber', 'vegetable', 15, 0.7, 3.6, 0.1, 0.5, 'estimate_v1'),
  ('tomato', 'طماطم', 'Tomato', 'vegetable', 18, 0.9, 3.9, 0.2, 1.2, 'estimate_v1'),
  ('lettuce', 'خس', 'Lettuce', 'vegetable', 15, 1.4, 2.9, 0.2, 1.3, 'estimate_v1'),
  ('carrot', 'جزر', 'Carrot', 'vegetable', 41, 0.9, 9.6, 0.2, 2.8, 'estimate_v1'),
  ('broccoli-cooked', 'بروكلي مسلوق', 'Cooked broccoli', 'vegetable', 35, 2.4, 7.2, 0.4, 3.3, 'estimate_v1'),
  ('zucchini-cooked', 'كوسة مطبوخة', 'Cooked zucchini', 'vegetable', 17, 1.2, 3.1, 0.3, 1, 'estimate_v1'),
  ('spinach-cooked', 'سبانخ مطبوخة', 'Cooked spinach', 'vegetable', 23, 3, 3.8, 0.3, 2.4, 'estimate_v1'),
  ('banana', 'موز', 'Banana', 'fruit', 89, 1.1, 22.8, 0.3, 2.6, 'estimate_v1'),
  ('apple', 'تفاح', 'Apple', 'fruit', 52, 0.3, 13.8, 0.2, 2.4, 'estimate_v1'),
  ('orange', 'برتقال', 'Orange', 'fruit', 47, 0.9, 11.8, 0.1, 2.4, 'estimate_v1'),
  ('dates', 'تمر', 'Dates', 'fruit', 282, 2.5, 75, 0.4, 8, 'estimate_v1'),
  ('watermelon', 'بطيخ', 'Watermelon', 'fruit', 30, 0.6, 7.6, 0.2, 0.4, 'estimate_v1'),
  ('mango', 'مانجو', 'Mango', 'fruit', 60, 0.8, 15, 0.4, 1.6, 'estimate_v1'),
  ('strawberries', 'فراولة', 'Strawberries', 'fruit', 32, 0.7, 7.7, 0.3, 2, 'estimate_v1'),
  ('milk-full-fat', 'لبن كامل الدسم', 'Full fat milk', 'dairy', 61, 3.2, 4.8, 3.3, 0, 'estimate_v1'),
  ('milk-skimmed', 'لبن خالي الدسم', 'Skimmed milk', 'dairy', 34, 3.4, 5, 0.1, 0, 'estimate_v1'),
  ('yogurt-plain', 'زبادي', 'Plain yogurt', 'dairy', 61, 3.5, 4.7, 3.3, 0, 'estimate_v1'),
  ('cottage-cheese', 'جبنة قريش', 'Cottage cheese', 'dairy', 98, 11, 3.4, 4.3, 0, 'estimate_v1'),
  ('feta-cheese', 'جبنة بيضاء', 'White (feta) cheese', 'dairy', 264, 14, 4, 21, 0, 'estimate_v1'),
  ('tea-plain', 'شاي سادة', 'Plain tea', 'drink', 1, 0, 0.3, 0, 0, 'estimate_v1'),
  ('coffee-plain', 'قهوة سادة', 'Plain coffee', 'drink', 2, 0.3, 0, 0, 0, 'estimate_v1'),
  ('orange-juice', 'عصير برتقال', 'Orange juice', 'drink', 45, 0.7, 10.4, 0.2, 0.2, 'estimate_v1'),
  ('cola', 'مشروب غازي', 'Cola', 'drink', 42, 0, 10.6, 0, 0, 'estimate_v1'),
  ('koshari', 'كشري', 'Koshari', 'composite', 155, 5.5, 27, 3.2, 3, 'estimate_v1'),
  ('mahshi', 'محشي', 'Mahshi (stuffed vegetables)', 'composite', 150, 3, 22, 5.5, 2, 'estimate_v1'),
  ('molokhia', 'ملوخية', 'Molokhia', 'composite', 45, 3.5, 5, 1.5, 2.5, 'estimate_v1'),
  ('fatta', 'فتة', 'Fatta', 'composite', 190, 8, 22, 8, 1.5, 'estimate_v1'),
  ('taameya', 'طعمية', 'Taameya (falafel)', 'composite', 333, 13, 32, 18, 5, 'estimate_v1'),
  ('ful-with-oil', 'فول بالزيت', 'Ful with oil', 'composite', 135, 6.5, 17, 4.5, 5, 'estimate_v1'),
  ('macarona-bechamel', 'مكرونة بشاميل', 'Macarona bechamel', 'composite', 190, 8, 20, 9, 1, 'estimate_v1'),
  ('hawawshi', 'حواوشي', 'Hawawshi', 'composite', 280, 12, 24, 15, 1, 'estimate_v1'),
  ('fries', 'بطاطس محمرة', 'French fries', 'composite', 312, 3.4, 41, 15, 3.8, 'estimate_v1'),
  ('whey-protein', 'واي بروتين', 'Whey protein powder', 'supplement', 400, 80, 8, 6, 0, 'estimate_v1');--> statement-breakpoint
INSERT INTO "food_units" ("food_id", "label_ar", "grams", "is_default", "position")
SELECT f."id", v."label_ar", v."grams", v."is_default", v."position" FROM (VALUES
  ('chicken-breast-grilled', 'قطعة متوسطة', 120::numeric, true, 0),
  ('chicken-breast-grilled', 'قطعة صغيرة', 80::numeric, false, 1),
  ('chicken-thigh-grilled', 'فخذ', 110::numeric, true, 0),
  ('beef-lean-cooked', 'قطعة متوسطة', 100::numeric, true, 0),
  ('kofta-grilled', 'قطعة', 50::numeric, true, 0),
  ('kofta-grilled', '3 قطع', 150::numeric, false, 1),
  ('liver-beef-cooked', 'حصة', 100::numeric, true, 0),
  ('tuna-canned-water', 'علبة', 140::numeric, true, 0),
  ('fish-grilled', 'قطعة متوسطة', 150::numeric, true, 0),
  ('shrimp-cooked', 'حصة', 100::numeric, true, 0),
  ('turkey-breast', 'شريحة', 40::numeric, true, 0),
  ('turkey-breast', 'حصة', 120::numeric, false, 1),
  ('egg-boiled', 'بيضة', 50::numeric, true, 0),
  ('egg-white', 'بياضة', 33::numeric, true, 0),
  ('ful-medames', 'طبق صغير', 150::numeric, true, 0),
  ('ful-medames', 'مغرفة', 60::numeric, false, 1),
  ('lentils-cooked', 'طبق صغير', 150::numeric, true, 0),
  ('lentils-cooked', 'مغرفة', 70::numeric, false, 1),
  ('chickpeas-cooked', 'كوب', 160::numeric, true, 0),
  ('chickpeas-cooked', 'مغرفة', 70::numeric, false, 1),
  ('rice-white-cooked', 'مغرفة', 80::numeric, true, 0),
  ('rice-white-cooked', 'كوب', 160::numeric, false, 1),
  ('rice-brown-cooked', 'مغرفة', 80::numeric, true, 0),
  ('rice-brown-cooked', 'كوب', 160::numeric, false, 1),
  ('bread-baladi', 'رغيف', 100::numeric, true, 0),
  ('bread-baladi', 'نصف رغيف', 50::numeric, false, 1),
  ('bread-fino', 'رغيفة', 70::numeric, true, 0),
  ('pasta-cooked', 'كوب', 140::numeric, true, 0),
  ('pasta-cooked', 'طبق', 200::numeric, false, 1),
  ('potato-boiled', 'حبة متوسطة', 150::numeric, true, 0),
  ('sweet-potato-baked', 'حبة متوسطة', 130::numeric, true, 0),
  ('oats-dry', 'ملعقة كبيرة', 10::numeric, true, 0),
  ('oats-dry', 'كوب', 80::numeric, false, 1),
  ('bulgur-cooked', 'كوب', 180::numeric, true, 0),
  ('olive-oil', 'ملعقة كبيرة', 13.5::numeric, true, 0),
  ('olive-oil', 'ملعقة صغيرة', 4.5::numeric, false, 1),
  ('tahini', 'ملعقة كبيرة', 15::numeric, true, 0),
  ('almonds', 'حفنة', 28::numeric, true, 0),
  ('walnuts', 'حفنة', 28::numeric, true, 0),
  ('peanut-butter', 'ملعقة كبيرة', 16::numeric, true, 0),
  ('avocado', 'حبة متوسطة', 200::numeric, true, 0),
  ('avocado', 'نصف حبة', 100::numeric, false, 1),
  ('ghee', 'ملعقة كبيرة', 14::numeric, true, 0),
  ('cucumber', 'حبة', 100::numeric, true, 0),
  ('tomato', 'حبة متوسطة', 120::numeric, true, 0),
  ('lettuce', 'كوب', 50::numeric, true, 0),
  ('carrot', 'حبة متوسطة', 80::numeric, true, 0),
  ('broccoli-cooked', 'كوب', 150::numeric, true, 0),
  ('zucchini-cooked', 'كوب', 180::numeric, true, 0),
  ('spinach-cooked', 'كوب', 180::numeric, true, 0),
  ('banana', 'حبة متوسطة', 120::numeric, true, 0),
  ('apple', 'حبة متوسطة', 180::numeric, true, 0),
  ('orange', 'حبة متوسطة', 150::numeric, true, 0),
  ('dates', 'حبة', 8::numeric, true, 0),
  ('watermelon', 'شريحة', 250::numeric, true, 0),
  ('mango', 'حبة متوسطة', 200::numeric, true, 0),
  ('strawberries', 'كوب', 150::numeric, true, 0),
  ('milk-full-fat', 'كوب', 240::numeric, true, 0),
  ('milk-skimmed', 'كوب', 240::numeric, true, 0),
  ('yogurt-plain', 'علبة', 150::numeric, true, 0),
  ('yogurt-plain', 'كوب', 245::numeric, false, 1),
  ('cottage-cheese', 'ملعقة كبيرة', 20::numeric, true, 0),
  ('cottage-cheese', 'علبة', 150::numeric, false, 1),
  ('feta-cheese', 'قطعة', 30::numeric, true, 0),
  ('tea-plain', 'كوب', 240::numeric, true, 0),
  ('coffee-plain', 'فنجان', 90::numeric, true, 0),
  ('orange-juice', 'كوب', 240::numeric, true, 0),
  ('cola', 'علبة', 330::numeric, true, 0),
  ('koshari', 'طبق متوسط', 450::numeric, true, 0),
  ('koshari', 'طبق صغير', 300::numeric, false, 1),
  ('mahshi', '5 قطع', 200::numeric, true, 0),
  ('mahshi', 'قطعة', 40::numeric, false, 1),
  ('molokhia', 'طبق', 200::numeric, true, 0),
  ('fatta', 'طبق', 350::numeric, true, 0),
  ('taameya', 'قرص', 30::numeric, true, 0),
  ('taameya', '4 أقراص', 120::numeric, false, 1),
  ('ful-with-oil', 'طبق صغير', 150::numeric, true, 0),
  ('macarona-bechamel', 'قطعة', 200::numeric, true, 0),
  ('hawawshi', 'قطعة', 200::numeric, true, 0),
  ('fries', 'طبق متوسط', 150::numeric, true, 0),
  ('whey-protein', 'مغرفة', 30::numeric, true, 0)
) AS v("slug", "label_ar", "grams", "is_default", "position")
JOIN "foods" f ON f."slug" = v."slug" AND f."workspace_id" IS NULL;--> statement-breakpoint

-- Foods and their units: everyone reads the library and their own workspace's additions; only a
-- workspace's own can be written. A library food is never changed through the application.
ALTER TABLE "foods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "foods" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "foods_read" ON "foods" FOR SELECT
  USING ("workspace_id" IS NULL OR "workspace_id" = app_workspace_id());--> statement-breakpoint
CREATE POLICY "foods_insert" ON "foods" FOR INSERT
  WITH CHECK ("workspace_id" = app_workspace_id());--> statement-breakpoint
CREATE POLICY "foods_update" ON "foods" FOR UPDATE
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());--> statement-breakpoint
CREATE POLICY "foods_delete" ON "foods" FOR DELETE
  USING ("workspace_id" = app_workspace_id());--> statement-breakpoint
ALTER TABLE "food_units" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "food_units" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "food_units_read" ON "food_units" FOR SELECT
  USING ("workspace_id" IS NULL OR "workspace_id" = app_workspace_id());--> statement-breakpoint
CREATE POLICY "food_units_insert" ON "food_units" FOR INSERT
  WITH CHECK ("workspace_id" = app_workspace_id());--> statement-breakpoint
CREATE POLICY "food_units_update" ON "food_units" FOR UPDATE
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());--> statement-breakpoint
CREATE POLICY "food_units_delete" ON "food_units" FOR DELETE
  USING ("workspace_id" = app_workspace_id());--> statement-breakpoint

-- The four tables of a nutrition plan are tenant tables like the rest: a coach sees and changes only
-- the plans of the workspace the request acts in, and a query that forgets its scope sees nothing.
ALTER TABLE "meal_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "meal_plans" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "meal_plans_tenant" ON "meal_plans" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());--> statement-breakpoint
ALTER TABLE "meals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "meals" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "meals_tenant" ON "meals" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());--> statement-breakpoint
ALTER TABLE "meal_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "meal_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "meal_items_tenant" ON "meal_items" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());--> statement-breakpoint
ALTER TABLE "meal_item_subs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "meal_item_subs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "meal_item_subs_tenant" ON "meal_item_subs" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());
