# Existing-foods USDA review

Reviewed 2026-10-31. Scope: exactly 63 existing foods; no new food records. Seed names, categories, numbers, units and starter-template quantities are preserved in the JSON. These are review recommendations, not application changes.

Evidence: local USDA Foundation Foods CSV release 2025-04-24 and SR Legacy CSV release 2018-04, as supplied in SPEC.md. Only actual foundation_food / sr_legacy_food rows were considered; sample and market-acquisition rows were excluded. Each JSON match carries its FDC link, CSV paths, nutrient values and available household portions. No external portion estimates were sourced.

Foundation is preferred for the same identity and state. SR is used where Foundation lacks cooked forms or would impose a cultivar, processing method or oil grade. USDA energy uses nutrient 1008 when present, otherwise 2048 (specific Atwater), then 2047 (general Atwater). Missing nutrients remain null; no values are borrowed across records. The nutrition-import validator does not apply to this analysis schema; dedicated checks validate all 63 mappings and dependencies.

| Verdict | Count | Meaning |
|---|---:|---|
| `keep_as_food` | 41 | Retain the food; rounding is close, or identity/product details need confirmation before replacement. |
| `replace_with_usda_values` | 11 | Same-food/state comparison supports updating the vector; any source nulls need follow-up before import. |
| `split_into_raw_and_cooked` | 2 | State is unspecified; clarify and eventually separate states without adding foods in this review. |
| `becomes_recipe_later` | 9 | Compute from ingredients and final cooked yield; preserve plan dependencies during migration. |

## Five largest energy discrepancies

Ranked by absolute kcal difference per 100 g among non-recipe foods with a proposed comparison. Signed percentages are `(seed - USDA) / USDA × 100`; positive means the seed is higher. Proxy comparisons identify uncertainty, not a proven error or permission for automatic replacement. Trace-macro percentages are in JSON; null means USDA is missing or the denominator is zero (both zero is 0%).

| Food | Seed → USDA kcal/100 g | Seed kcal difference | Other key difference, seed → USDA g/100 g | Interpretation |
|---|---:|---:|---|---|
| `tahini` | 595 → 648.37 | -8.23% | fat: 54 → 62.4 (-13.46%) | Foundation creamy sesame butter; confirm pure paste and sesame type, not diluted tahini sauce. |
| `whey-protein` | 400 → 352.00 | +13.64% | fat: 6 → 1.56 (+284.62%) | Formulation proxy; label needed before changing a generic supplement. |
| `chicken-thigh-grilled` | 209 → 179.00 | +16.76% | fat: 11 → 8.15 (+34.97%) | Roasted skinless proxy; skin and added fat are unresolved. |
| `tuna-canned-water` | 116 → 90.00 | +28.89% | protein: 26 → 19 (+36.84%) | Foundation drained light tuna; old vector matches SR canned tuna more closely. |
| `walnuts` | 654 → 678.66 | -3.63% | fat: 65 → 69.74 (-6.80%) | Foundation raw English walnuts; difference from the older SR-like vector, not a state error. |

## Numbers, identity and state concerns

- No convincing tenfold or slipped-decimal error was found. All 63 seed vectors satisfy the SPEC macro-energy, total-macro and fiber consistency checks; that does not establish that the foods are correctly identified.
- `zucchini-cooked` is 17 kcal / 1.2 protein / 3.1 carbs / 0.3 fat, which resembles raw zucchini (SR 169291) more closely than boiled zucchini (SR 169292: 15 / 1.14 / 2.69 / 0.36). Likely state-copy issue, with a small absolute impact.
- `turkey-breast` has no state. Its 30 g protein suggests cooked meat, while the cited roasted vector is 147 kcal / 30.13 protein / 2.08 fat, versus seed 135 / 30 / 1. Raw SR 171098 is included separately in JSON as evidence. A 40 g slice does not establish a deli product.
- `egg-white` also has no state. Seed 52 / 11 / 0.7 / 0.2 resembles SR raw egg white 172183; Foundation 747997 reports 55 / 10.7 / 2.36 / 0. Foundation reports fat zero, so the seed fat percentage difference is undefined, not infinite.
- `chicken-thigh-grilled`: meat-only roasted SR 172388 is 179 kcal / 8.15 fat, while meat-and-skin roasted SR 173625 is 232 / 14.71. Seed 209 / 11 lies between them; establish skin, bone and oil rather than label it a raw/cooked error.
- `beef-lean-cooked`: seed 250 / 26 / 15 closely reproduces cooked ground beef 85% lean, not a uniquely identified lean steak/cut. `fish-grilled` closely reproduces tilapia, not all fish. Clarify both identities.
- `cottage-cheese` names Arabic جبنة قريش, while the seed resembles full-fat US cottage cheese. The latter is a comparison proxy, not a validated qareesh replacement. `feta-cheese` likewise needs confirmation that generic white cheese is actually feta.
- `tahini` must mean undiluted sesame paste, not lemon/water sauce. The Foundation vector is higher-fat than the old SR-like estimate. `yogurt-plain` and `feta-cheese` show real dataset differences in fat/solids, not proof of decimal errors.
- Do not report false errors: `rice-brown-cooked` matches SR **medium-grain** 168875 (112 kcal, 2.32 protein, 23.51 carbs, 0.83 fat, 1.8 fiber); long-grain 169704 differs. `liver-beef-cooked` matches **pan-fried** 168627 energy 175 kcal, rather than braised 191 kcal; its carbs still differ 4 versus 5.16 g. `oats-dry` matches generic oats 169705; Foundation rolled oats have a different specified form.
- Foundation lacks fiber in the selected tuna, raw egg-white, cucumber, green-leaf lettuce, strawberries, both milks, yogurt, cottage cheese and feta rows; SR cooked shrimp and falafel also have no fiber row. Unknown stays null even for foods where zero seems biologically plausible.

## Household-unit findings

All seed unit rows and default markers are retained in JSON. Unit weights always refer to edible mass in the logged state. Differences from USDA portions are prompts to measure local portions, not automatic changes.

| Food(s) | Concern / source evidence |
|---|---|
| `tuna-canned-water` | Seed can 140 g has no drained qualifier; Foundation 334194 gives 142 g total contents but only 107 g drained solids. Apply drained nutrition only to drained mass; actual cans vary. |
| `oats-dry` | A level tablespoon of dry rolled oats is approximately 81/16 = 5.06 g from SR 173904 cup 81 g (US volume conversion); 10 g implies a heaped spoon. Seed cup 80 g is close. This is a rolled-oat comparator, not evidence for groats. |
| `rice-brown-cooked` | Seed cup 160 g versus cooked medium-grain SR 168875 cup 195 g; verify packing and local cup size. The 80 g ladle has no USDA standard. |
| `carrot` | Seed medium carrot 80 g versus SR 170393 medium 61 g and large 72 g; relabel size or weigh local carrots. |
| `lettuce` | Seed cup 50 g versus SR 169249 green-leaf shredded cup 36 g; packing, lettuce type and cutting change the weight. |
| `ghee` | Seed tablespoon 14 g versus butter oil SR 173412 tablespoon 12.8 g; verify spoon volume and temperature. |
| `milk-full-fat` | Seed cup 240 g; Foundation 746782 household row 249 g and SR 171265 cup 244 g. Specify cup volume and density; 240 mL is not automatically 240 g milk. |
| `milk-skimmed` | Seed cup 240 g; Foundation 746776 household row 246 g and SR 171269 cup 245 g. Specify cup volume and density. |
| `orange-juice` | Seed cup 240 g versus SR 169098 cup 248 g. Specify cup volume; do not assume juice density equals water. |
| `cola` | 330 g can likely conflates mL and g. SR 174852 has 30.7 g/fl oz; a 330 mL can would be about 342.6 g using 29.5735 mL/fl oz. Confirm actual can volume/density. |
| `chicken-thigh-grilled` | Seed thigh 110 g is close to SR 172388 skinless edible thigh 116 g; never include bone in the logged grams and clarify whether skin is eaten. |
| `orange` | Seed medium orange 150 g versus SR 169097 fruit 131 g; nutrition applies to peeled edible flesh. |
| `mango` | Seed medium mango 200 g versus SR 169910 edible fruit 336 g; cultivar differences are large, so weigh flesh without stone/peel rather than force the USDA size. |
| `cucumber` | Seed cucumber 100 g is plausible for a small local cucumber; SR 168409 301 g is an 8.25-inch cucumber and should not replace it. |
| `bread-baladi` | 100 g loaf / 50 g half are internally consistent but unverified locally; USDA whole-wheat pita 64 g is not evidence for a baladi loaf. |
| `bread-fino` | 70 g roll is unverified locally; the USDA French-bread portion is not a fino roll. |
| `cottage-cheese` | 20 g tablespoon and 150 g container need qareesh-specific measurements; US cottage-cheese portions do not establish qareesh weights. |
| `coffee-plain` | 90 g finjan is unverified; brewed coffee and Egyptian/Turkish finjan sizes are not interchangeable. |
| `whey-protein` | 30 g scoop versus SR 173180 one-third cup 32 g is not a scoop validation; weigh the actual product scoop. |
| `fries` | Seed medium plate 150 g is close to USDA large fast-food serving 154 g, not its medium 117 g; plate and packet labels differ. |

Other size differences: sweet potato 130 g versus USDA medium 114 g; dates 8 g versus Deglet Noor 7.1 g pitted. Avocado 200 g is close to generic USDA 201 g edible fruit; do not treat it as an obvious error. Egg 50 g, white 33 g versus Foundation 34 g, tomato 120 versus 123 g, banana 120 versus 118 g, apple 180 versus 182 g, white-rice cup 160 versus 158 g, chickpea cup 160 versus 164 g, bulgur cup 180 versus 182 g, cooked spinach cup 180 g and olive-oil tablespoons/teaspoons 13.5/4.5 g are reasonable comparisons. Pasta cup 140 g depends on shape and is compatible with cooked spaghetti-style measures; plates, ladles and containers have no universal weight.

Prepared-dish portions (plates/pieces/bowls), kofta 50 g, taameya 30 g, yogurt container 150 g and whey scoop 30 g are assumptions until weighed. Kofta three-piece, mahshi five-piece, taameya four-piece, baladi half-loaf and avocado half-fruit multipliers are internally consistent. USDA falafel 17 g is not evidence that an Egyptian taameya disc must weigh 17 g.

Changing a default unit changes every starter-template serving even if its slug is preserved. For example, the bulking template uses 3 default ladles of white rice = 240 g, not 3 cups. Its 2 thighs are 220 g edible mass under the current default. Cutting-template tuna is 140 g under the current default, which must be checked against drained can yield.

## Starter-plan slugs that must remain exact

22 distinct slugs across 27 item occurrences. Quantities below are multipliers of the existing default unit, not grams or automatically cups. JSON additionally gives the exact Arabic template/meal names, default-unit label and resulting grams. Keep all these slugs through migration; `ful-with-oil` needs an explicit recipe transition because a template uses it.

| Slug | Template / meal / quantity × default unit (= g) |
|---|---|
| `chicken-breast-grilled` | تنشيف - حوالي 1500 سعر / الغداء: 1.5 × 120 g = 180 g |
| `chicken-thigh-grilled` | تضخيم - حوالي 2800 سعر / الغداء: 2 × 110 g = 220 g |
| `beef-lean-cooked` | تضخيم - حوالي 2800 سعر / العشاء: 1.5 × 100 g = 150 g |
| `tuna-canned-water` | تنشيف - حوالي 1500 سعر / العشاء: 1 × 140 g = 140 g |
| `egg-boiled` | تنشيف - حوالي 1500 سعر / الفطار: 2 × 50 g = 100 g; تضخيم - حوالي 2800 سعر / الفطار: 2 × 50 g = 100 g |
| `rice-white-cooked` | تنشيف - حوالي 1500 سعر / الغداء: 1 × 80 g = 80 g; تضخيم - حوالي 2800 سعر / الغداء: 3 × 80 g = 240 g |
| `bread-baladi` | تنشيف - حوالي 1500 سعر / الفطار: 0.5 × 100 g = 50 g; تنشيف - حوالي 1500 سعر / العشاء: 0.5 × 100 g = 50 g; تضخيم - حوالي 2800 سعر / الفطار: 1 × 100 g = 100 g |
| `potato-boiled` | تضخيم - حوالي 2800 سعر / العشاء: 2 × 150 g = 300 g |
| `olive-oil` | تنشيف - حوالي 1500 سعر / الغداء: 1 × 13.5 g = 13.5 g; تضخيم - حوالي 2800 سعر / الغداء: 1 × 13.5 g = 13.5 g |
| `peanut-butter` | تضخيم - حوالي 2800 سعر / سناك: 2 × 16 g = 32 g |
| `cucumber` | تنشيف - حوالي 1500 سعر / الفطار: 1 × 100 g = 100 g |
| `tomato` | تنشيف - حوالي 1500 سعر / الفطار: 1 × 120 g = 120 g |
| `lettuce` | تنشيف - حوالي 1500 سعر / العشاء: 2 × 50 g = 100 g |
| `broccoli-cooked` | تضخيم - حوالي 2800 سعر / الغداء: 1 × 150 g = 150 g |
| `zucchini-cooked` | تنشيف - حوالي 1500 سعر / الغداء: 1 × 180 g = 180 g |
| `spinach-cooked` | تضخيم - حوالي 2800 سعر / العشاء: 1 × 180 g = 180 g |
| `banana` | تضخيم - حوالي 2800 سعر / سناك: 2 × 120 g = 240 g |
| `apple` | تنشيف - حوالي 1500 سعر / سناك: 1 × 180 g = 180 g |
| `milk-full-fat` | تضخيم - حوالي 2800 سعر / الفطار: 1 × 240 g = 240 g |
| `yogurt-plain` | تنشيف - حوالي 1500 سعر / سناك: 1 × 150 g = 150 g |
| `ful-with-oil` | تضخيم - حوالي 2800 سعر / الفطار: 1 × 150 g = 150 g |
| `whey-protein` | تضخيم - حوالي 2800 سعر / سناك: 1 × 30 g = 30 g |

## Category-agent coverage order

Every existing slug appears once below; category remains the seed category in JSON. Kofta is placed with prepared dishes because its review calls for a recipe. Fries remain a generic ready-to-eat food even though their seed category is composite.

Protein / dairy / legumes (18): `chicken-breast-grilled`, `chicken-thigh-grilled`, `beef-lean-cooked`, `liver-beef-cooked`, `tuna-canned-water`, `fish-grilled`, `shrimp-cooked`, `turkey-breast`, `egg-boiled`, `egg-white`, `ful-medames`, `lentils-cooked`, `chickpeas-cooked`, `milk-full-fat`, `milk-skimmed`, `yogurt-plain`, `cottage-cheese`, `feta-cheese`.

Carbs (9): `rice-white-cooked`, `rice-brown-cooked`, `bread-baladi`, `bread-fino`, `pasta-cooked`, `potato-boiled`, `sweet-potato-baked`, `oats-dry`, `bulgur-cooked`.

Vegetables / fruit (14): `cucumber`, `tomato`, `lettuce`, `carrot`, `broccoli-cooked`, `zucchini-cooked`, `spinach-cooked`, `banana`, `apple`, `orange`, `dates`, `watermelon`, `mango`, `strawberries`.

Fats / drinks / supplements (12): `olive-oil`, `tahini`, `almonds`, `walnuts`, `peanut-butter`, `avocado`, `ghee`, `tea-plain`, `coffee-plain`, `orange-juice`, `cola`, `whey-protein`.

Prepared dishes (10): `kofta-grilled`, `koshari`, `mahshi`, `molokhia`, `fatta`, `taameya`, `ful-with-oil`, `macarona-bechamel`, `hawawshi`, `fries`.

## Recipe / source gaps

No honest single USDA match was assigned to `kofta-grilled`, `koshari`, `mahshi`, `molokhia`, `fatta`, `ful-with-oil`, `macarona-bechamel` or `hawawshi`. Their match and all USDA comparison percentages are null. `taameya` retains a clearly marked home-prepared falafel proxy, without asserting that it is Egyptian fava falafel. All nine need recipes and final cooked yield; no ingredients, recipes or foods were created.

Judgment calls: generic SR cultivar/form/grade comparisons were retained for banana, apple, orange, mango, avocado, dates, oats, olive oil and fresh orange juice; whole-wheat pita and French bread are Egyptian bread proxies; skinless roasted chicken is a grilled proxy; qareesh, generic beef, unspecified fish, coffee and whey require identity/preparation/formulation confirmation. Replacement recommendations apply to the stated USDA interpretation, especially whole-milk yogurt, actual feta and pure sesame paste. A null required nutrient must be sourced before producing an importable seed.

## Per-food decision index

| Existing slug | Seed category | Verdict | USDA FDC ID / quality |
|---|---|---|---|
| `chicken-breast-grilled` | protein | `keep_as_food` | 171477 / proxy |
| `chicken-thigh-grilled` | protein | `keep_as_food` | 172388 / proxy |
| `beef-lean-cooked` | protein | `keep_as_food` | 174032 / proxy |
| `kofta-grilled` | protein | `becomes_recipe_later` | none |
| `liver-beef-cooked` | protein | `keep_as_food` | 168627 / direct_with_preparation_assumption |
| `tuna-canned-water` | protein | `replace_with_usda_values` | 334194 / direct |
| `fish-grilled` | protein | `keep_as_food` | 175177 / proxy |
| `shrimp-cooked` | protein | `keep_as_food` | 175180 / direct |
| `turkey-breast` | protein | `split_into_raw_and_cooked` | 171496 / direct_with_preparation_assumption |
| `egg-boiled` | protein | `keep_as_food` | 173424 / direct |
| `egg-white` | protein | `split_into_raw_and_cooked` | 747997 / direct_with_preparation_assumption |
| `ful-medames` | protein | `keep_as_food` | 173753 / direct_with_preparation_assumption |
| `lentils-cooked` | protein | `keep_as_food` | 172421 / direct |
| `chickpeas-cooked` | protein | `keep_as_food` | 173757 / direct |
| `rice-white-cooked` | carb | `keep_as_food` | 169757 / direct |
| `rice-brown-cooked` | carb | `keep_as_food` | 168875 / direct |
| `bread-baladi` | carb | `keep_as_food` | 174916 / proxy |
| `bread-fino` | carb | `keep_as_food` | 172675 / proxy |
| `pasta-cooked` | carb | `keep_as_food` | 169737 / direct |
| `potato-boiled` | carb | `keep_as_food` | 170438 / direct |
| `sweet-potato-baked` | carb | `keep_as_food` | 168483 / direct |
| `oats-dry` | carb | `keep_as_food` | 169705 / direct |
| `bulgur-cooked` | carb | `keep_as_food` | 170287 / direct |
| `olive-oil` | fat | `keep_as_food` | 171413 / direct |
| `tahini` | fat | `replace_with_usda_values` | 2262073 / direct |
| `almonds` | fat | `replace_with_usda_values` | 2346393 / direct |
| `walnuts` | fat | `replace_with_usda_values` | 2346394 / direct |
| `peanut-butter` | fat | `replace_with_usda_values` | 2262072 / direct |
| `avocado` | fat | `keep_as_food` | 171705 / direct |
| `ghee` | fat | `keep_as_food` | 173412 / direct |
| `cucumber` | vegetable | `replace_with_usda_values` | 2346406 / direct |
| `tomato` | vegetable | `keep_as_food` | 170457 / direct |
| `lettuce` | vegetable | `replace_with_usda_values` | 2346391 / direct |
| `carrot` | vegetable | `replace_with_usda_values` | 2258586 / direct |
| `broccoli-cooked` | vegetable | `keep_as_food` | 169967 / direct |
| `zucchini-cooked` | vegetable | `replace_with_usda_values` | 169292 / direct |
| `spinach-cooked` | vegetable | `keep_as_food` | 168463 / direct |
| `banana` | fruit | `keep_as_food` | 173944 / direct |
| `apple` | fruit | `keep_as_food` | 171688 / direct |
| `orange` | fruit | `keep_as_food` | 169097 / direct |
| `dates` | fruit | `keep_as_food` | 171726 / proxy |
| `watermelon` | fruit | `keep_as_food` | 167765 / direct |
| `mango` | fruit | `keep_as_food` | 169910 / direct |
| `strawberries` | fruit | `keep_as_food` | 2346409 / direct |
| `milk-full-fat` | dairy | `keep_as_food` | 746782 / direct |
| `milk-skimmed` | dairy | `keep_as_food` | 746776 / direct |
| `yogurt-plain` | dairy | `replace_with_usda_values` | 2259793 / direct |
| `cottage-cheese` | dairy | `keep_as_food` | 2346384 / proxy |
| `feta-cheese` | dairy | `replace_with_usda_values` | 2259796 / direct |
| `tea-plain` | drink | `keep_as_food` | 173227 / direct |
| `coffee-plain` | drink | `keep_as_food` | 171890 / proxy |
| `orange-juice` | drink | `keep_as_food` | 169098 / direct |
| `cola` | drink | `keep_as_food` | 174852 / direct |
| `koshari` | composite | `becomes_recipe_later` | none |
| `mahshi` | composite | `becomes_recipe_later` | none |
| `molokhia` | composite | `becomes_recipe_later` | none |
| `fatta` | composite | `becomes_recipe_later` | none |
| `taameya` | composite | `becomes_recipe_later` | 172455 / proxy |
| `ful-with-oil` | composite | `becomes_recipe_later` | none |
| `macarona-bechamel` | composite | `becomes_recipe_later` | none |
| `hawawshi` | composite | `becomes_recipe_later` | none |
| `fries` | composite | `keep_as_food` | 170698 / direct_with_preparation_assumption |
| `whey-protein` | supplement | `keep_as_food` | 173180 / proxy |
