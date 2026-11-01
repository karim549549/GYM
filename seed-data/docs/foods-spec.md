# Nutrition data collection: shared specification

You are one of several agents collecting seed data for a coaching app used in Egypt (Arabic first, Egyptian
colloquial names). Everything you produce is read by people and then turned into database seed files, so
accuracy and honesty matter more than volume. Never invent a number. Unknown stays unknown.

Working root: `D:\fun-code\gym\nutrition-data` (not a git repository). Write only inside `out/` (your own file),
never inside `_cache/` or `_context/`. Other agents write other files at the same time: do not touch their files.

## Local data you can use (already downloaded, no rate limits)

USDA FoodData Central, public domain (CC0), unzipped CSVs:
- `_cache/usda/foundation/FoodData_Central_foundation_food_csv_2025-04-24/` (Foundation Foods, newest, best quality)
- `_cache/usda/sr_legacy/FoodData_Central_sr_legacy_food_csv_2018-04/` (SR Legacy, broadest coverage)
Files: `food.csv` (fdc_id, description, food_category_id), `food_nutrient.csv` (fdc_id, nutrient_id, amount, per 100 g),
`nutrient.csv` (id, name, unit_name), `food_portion.csv` (household measures with gram_weight), `food_category.csv`.
Useful nutrient ids (verify against nutrient.csv): energy kcal 1008, protein 1003, total fat 1004, carbohydrate by
difference 1005, fibre 1079, total sugars 2000 (or 1063), saturated fat 1258, sodium 1093 (mg), calcium 1087 (mg), iron 1089 (mg),
potassium 1092 (mg), vitamin C 1162 (mg). Foundation Foods may report energy under 2047 or 2048 (Atwater) instead of 1008:
use those as a fallback and say so. All amounts are per 100 g.
Prefer Foundation Foods, then SR Legacy. Write small scripts (Node.js or Python, whichever runs in your sandbox) to search
and extract; keep them in `out/<your-name>-scripts/`.

You may also use web search to verify Egyptian portion weights and names, and to find sources for foods USDA lacks. Cite every URL
you rely on in `origin_note`. Do not copy copyrighted text or tables wholesale; read, then record the numbers and the source.

## Output: one JSON file, an array of food objects

```json
{
  "slug": "chicken-breast-raw",
  "name_ar": "صدر فراخ نيء",
  "name_en": "Chicken breast, raw",
  "aliases_ar": ["فراخ", "صدور فراخ", "بانيه نيء"],
  "aliases_en": ["chicken breast", "chicken fillet"],
  "category": "protein",
  "state": "raw",
  "calories_kcal_per_100g": 120,
  "protein_g_per_100g": 22.5,
  "carbs_g_per_100g": 0,
  "fat_g_per_100g": 2.6,
  "fiber_g_per_100g": 0,
  "nutrients": { "sugars_g": 0, "saturated_fat_g": 0.6, "sodium_mg": 45, "calcium_mg": 5, "iron_mg": 0.4, "potassium_mg": 370, "vitamin_c_mg": null },
  "portions": [
    { "name_ar": "صدر متوسط", "weight_g": 170, "is_default": true, "basis": "USDA food_portion fdc 171477 (1 breast, bone and skin removed)" }
  ],
  "origin": "seed",
  "origin_note": "USDA Foundation Foods 2025-04-24, fdc_id 123456",
  "usda_fdc_id": 123456,
  "confidence": "high",
  "review_flags": []
}
```

Rules, all enforced by `validate-foods.cjs`:
1. `slug`: lowercase English kebab-case, semantic and stable, with the state at the end when it matters
   (`rice-white-raw`, `rice-white-cooked`, `chicken-breast-grilled`). Unique across ALL files in `out/`. If the food already exists in
   `_context/existing-seed-0031.sql`, reuse its slug exactly and set `"replaces_existing": true`.
2. `category`: one of protein, carb, fat, vegetable, fruit, dairy, drink, composite, supplement (see `_context/food-category.enum.ts`).
   `composite` is only for a prepared dish that is eaten as one thing and bought or served ready (a restaurant plate).
3. `state`: `raw`, `cooked`, `ready_to_eat` or `dry`. Raw and cooked are different foods with different slugs and numbers.
4. Per-100 g numbers are numbers (not strings). Calories, protein, carbs, fat, fibre are required. Everything in `nutrients` is
   optional: use `null` when unknown (never 0 unless the source says 0).
5. Macro consistency, the same rule the app enforces: |calories - (4*protein + 4*carbs + 9*fat)| <= max(20, 0.25 * that sum);
   protein + carbs + fat <= 100; fibre <= carbs. If a USDA row breaks this, fix the cause (wrong nutrient id, alcohol, unit) or flag it.
6. `portions`: 1 to 5 household measures that Egyptians really use (قطعة، ملعقة كبيرة، ملعقة صغيرة، كوب، رغيف، طبق، علبة). Exactly one
   `is_default`. `weight_g` is a number > 0. `basis` says where the weight came from. For liquids, grams = ml x density: say so.
7. `confidence`: `high` (a direct USDA match for the same food and state), `medium` (a close proxy, or a portion assumption),
   `low` (weak proxy or estimate). Anything not `high` needs a reason in `review_flags` (short snake_case codes, plus a sentence in
   `origin_note`). Typical flags: `egyptian_proxy`, `portion_assumed`, `brand_varies`, `state_unclear`, `needs_second_source`.
8. Foods that USDA lacks (many Egyptian items): use the closest USDA proxy, set `confidence` to `medium` or `low`, flag `egyptian_proxy`
   and explain the proxy. If no honest proxy or source exists, still list the food but set the nutrition numbers to `null` and
   `confidence` to `none`, flag `no_source`, and list it in your report: a person will source it.
9. Arabic: Egyptian colloquial first (`صدر فراخ`, not `صدر دجاج`), plus the formal name or other common names as aliases. No diacritics.
   Write names yourself; do not machine-copy. Mark any you are unsure of with the flag `arabic_name_unsure`.
10. Do not include packaged supermarket products or brands. This list is generic foods only.

## Validate before you finish

`node validate-foods.cjs out/<your-file>.json` from the working root. It must print `OK`. Fix every error; warnings are listed in
your report. Run it on all files (`node validate-foods.cjs out`) to catch slug clashes with other agents, and if a clash is yours,
rename yours (never theirs).

## Report (your final message)

Short: the file written, the number of foods per category, how many are `high`, `medium`, `low`, `none`, the list of foods you could
not source, every place you made a judgement call, and anything surprising. No filler.
