# Recipes: specification

Read SPEC.md first (sources, honesty rules, report format). This file adds only what is specific to recipes.

A recipe is a homemade dish built from foods that already exist in `out/foods-*.json` (read those files; refer to ingredients by `slug`).
Its nutrition is CALCULATED from its ingredients and its finished weight, never typed in. The validator does the calculation.

## Output: one JSON file, an array of recipe objects

```json
{
  "slug": "koshari-homemade",
  "name_ar": "كشري بيتي",
  "name_en": "Koshari, homemade",
  "aliases_ar": ["كشري", "كشري مصري"],
  "aliases_en": ["koshary"],
  "description_ar": "جملة أو جملتين عن الأكلة.",
  "meal_tags": ["lunch", "dinner"],
  "finished_weight_g": 1900,
  "prep_minutes": 30,
  "cook_minutes": 60,
  "ingredients": [
    { "food_slug": "rice-white-raw", "weight_g": 200, "note_ar": "أرز مصري" },
    { "food_slug": "lentils-brown-dry", "weight_g": 100 }
  ],
  "steps_ar": ["اسلق العدس...", "اغسل الأرز..."],
  "youtube_video_id": null,
  "portions": [
    { "name_ar": "طبق", "weight_g": 350, "is_default": true, "basis": "typical home plate, 300 to 400 g" }
  ],
  "yield_note": "Weight after cooking, including absorbed water; measured/estimated how and from where.",
  "origin": "seed",
  "origin_note": "Ingredient quantities from <source URL(s)>; nutrition calculated from the foods listed.",
  "confidence": "medium",
  "review_flags": ["quantities_vary_by_household"]
}
```

Rules, enforced by `validate-recipes.cjs`:
1. `slug`: lowercase kebab-case, unique across recipes AND not equal to any food slug.
2. Every `ingredients[].food_slug` must exist in the foods files AND have real nutrition (not a `confidence: none` food). `weight_g` is the weight as it goes
   into the pot, in the STATE of that food (a raw rice food means raw weight). If the right food does not exist, do not invent a slug: list the
   missing food in your report, pick the closest existing one and flag `ingredient_proxy`, or leave the recipe out.
   Water, salt and other zero-calorie items may be left out of `ingredients` (they add no nutrition), but their effect on weight belongs in `finished_weight_g`.
3. `finished_weight_g` is the weight of the finished dish as served. It is the number that sets the per-100 g values, so justify it in `yield_note`
   (rice and pasta absorb 2 to 3 times their dry weight in water; oil and stock are partly left behind; vegetables lose water). The validator warns when it
   is outside 0.4x to 3.5x of the summed ingredient weights and errors outside 0.25x to 5x.
4. 3 to 25 ingredients. `steps_ar`: 3 to 12 short steps in Egyptian colloquial Arabic (no diacritics), the way a home cook would say them.
   `prep_minutes` and `cook_minutes` are integers or null.
5. `youtube_video_id`: only an 11-character YouTube id that you actually opened and confirmed is a recipe video for this dish, with the title and channel
   recorded in `origin_note`. Otherwise `null`. Never guess an id.
6. `meal_tags`: zero or more of breakfast, lunch, dinner, snack, pre_workout, post_workout. They are optional labels, not rules.
7. `portions`: 1 to 4 realistic servings (طبق، قطعة، شريحة، كوب), exactly one default, weights > 0 with a `basis`.
8. Calculated nutrition (per 100 g of finished dish) must pass the same macro rule as foods: calories within max(20, 25 percent) of 4p + 4c + 9f, and be between
   20 and 600 kcal per 100 g. A recipe breaking this has a wrong quantity or yield: fix it, do not hide it.
9. `confidence`: `high` only when quantities come from a clearly authoritative recipe and every ingredient food is `high`; `medium` for a typical home version; `low` when
   quantities are your own reasonable assumption. Anything not `high` needs a `review_flags` entry. Typical: `quantities_vary_by_household`, `ingredient_proxy`, `yield_estimated`.
10. Egyptian colloquial Arabic names and aliases (no diacritics). Mark `arabic_name_unsure` when unsure.

Validate: `node validate-recipes.cjs out/<your-file>.json` must print `OK`. It prints the calculated per-100 g values and the per-portion values for review:
read them and ask whether a coach would believe them (a plate of koshari near 350 g should be a few hundred to about 700 kcal, not 2000).
