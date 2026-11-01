# Independent nutrition QA — 90 priority foods

Read/extracted **2026-10-31**, per 100 g edible food unless noted. This is a risk-focused selection, not a measured popularity ranking. All 22 distinct starter-plan slugs are included. The 90-row table below is the exact chosen list; it contains 10 common vegetables and 10 common fresh fruits, exceeding the requested 15 combined, plus dates. No seed files were changed.

**Result: 90 foods screened; 61 foods flagged; 29 with no flag in this bounded screen. 133 field-level flags comprise 103 numerical threshold breaches, 6 portion-weight concerns, and 24 identity/missing-evidence flags.** A flag is a request for review, not a finding that the second number is necessarily better.

**Coverage limit:** all 90 have a recorded kcal/protein/carbohydrate/fat comparison, but only 77 have a reported second total-fibre number. 13 lack compatible independent total-fibre evidence; 4 additional fibre comparisons reuse the seed's own SR fallback. Several comparisons are explicitly proxies or calculated scenarios. This is not a claim of 90 fully matched, independently measured five-nutrient validations. The gaps are flagged rather than hidden.

## Five most serious problems

1. **Full-fat labneh is populated from Greek yogurt.** 94.51 kcal and 4.394 g fat versus independently assayed full-fat labneh means of 10.25 g fat and calculated 151.33 kcal. The name promises a food the source does not establish. [Independent labneh assays](https://www.journalofdairyscience.org/article/S0022030212000045/pdf).
2. **Local fish names hide species differences.** Sea-bass raw is 97 kcal/2 g fat versus UK sea bass 168/9.8; generic grilled fish is only tilapia. A client choosing mackerel can get a very different fat/energy intake. This is a food-matching issue, not a reason to replace every fish with UK sea bass. [CoFID](https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid).
3. **The nominal 10%-fat raw ground beef actually contains 12.85% fat.** SR reports 10 g/100 g. Foundation extraction is faithful, but the slug implies more precision than the sample supports. [SR 90/10 raw beef](https://fdc.nal.usda.gov/food-details/174030/nutrients).
4. **Rumi is Romano, with materially different protein from an Egyptian Ras sample.** 31.8 versus 22.16 g protein; 387 versus calculated 324.65 kcal. Ripening matters, but a local label should not silently inherit a foreign cheese profile. [Egyptian Ras ingredient analysis](https://ejfs.journals.ekb.eg/article_328053_135b62aeabeb84b1c010124cf19c7d3a.pdf).
5. **Generic whey is a formulation gamble in a starter plan.** Seed 352 kcal/1.56 g fat/3.1 g fibre versus assayed WPC-80 409.18/6.72/<0.5. Protein happens to agree. A generic scoop must not imply a verified product formula. [Independent WPC-80 analysis](https://www.mdpi.com/2072-6643/10/9/1178).

Household-unit risk is also material: lettuce 36 g/cup is about 35.5% below the Canadian US-volume-equivalent reference; a mango default is 336 g edible versus 208 g inferred from Canada's half-fruit reference; the 100 g baladi convention exceeds the reported 90 g subsidized loaf. These are sizing/packing concerns with direct client consequences. [Health Canada](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html), [25 October 2026 spokesperson report](https://www.alwafd.news/5987906).

## Decision rules and comparability

- Signed `difference_pct = 100 × (our − other) / abs(other)`. Flag energy when the absolute difference exceeds 10% of the reference; flag each macro/fibre when it exceeds both 15% of the reference and 1.5 g. Strict `>` comparisons use unrounded values. If the reference is zero, a nonzero difference meeting the absolute rule is flagged and percentage is `null` (undefined). Missing evidence and identity flags also have `null` percentages. WPC fibre uses the reported upper bound 0.5, making its difference conservative.
- UK carbohydrate is available carbohydrate expressed as monosaccharide equivalents; USDA carbohydrate-by-difference includes fibre. Raw numbers are shown as published, without inventing a universal conversion. Threshold breaches across these definitions are retained as **basis warnings**, not confirmed total-carbohydrate errors. AOAC fibre is used where available; NSP and crude fibre are explicitly not relabelled total dietary fibre. UK `Tr` is screened as approximately zero, not an exact absence; `N`/blank stays unknown. [CoFID user guide](https://assets.publishing.service.gov.uk/media/60538e66d3bf7f03249bac58/McCance_and_Widdowsons_Composition_of_Foods_integrated_dataset_2021.pdf).
- Separate Foundation and SR datasets are allowed as independent comparisons by the task. They can still share historical inputs, particularly fibre fallbacks; matching numbers alone are not proof of separate laboratory samples. CoFID entry-level references were inspected and are retained in `out/q-scripts/comparisons.json`; the USDA-derived CoFID whole-almond entry was avoided. Canadian portions/fibre are published second references, with possible USDA ancestry explicitly acknowledged.
- A cooked state is never compared directly with a dry/raw value. Near matches in cooking method, cut, species, maturity or edible part are disclosed below. “ok” means no threshold/identity/coverage/portion flag arose in the selected screen; it is not certification of Egyptian equivalence or a validated household portion.

## Exact selection and kcal summary

| # | Slug | Our kcal | Other kcal | Verdict | Second reference |
|---:|---|---:|---:|---|---|
| 1 | chicken-breast-raw | 112.202 | 120 | ok | [sr:171077](https://fdc.nal.usda.gov/food-details/171077/nutrients) |
| 2 | chicken-breast-grilled | 151 | 148 | ok | [uk:18-323](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 3 | chicken-breast-boiled | 151 | 160 | flag | [uk:18-307](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 4 | chicken-thigh-raw | 149.306 | 121 | flag | [sr:173627](https://fdc.nal.usda.gov/food-details/173627/nutrients) |
| 5 | chicken-thigh-grilled | 179 | 196 | flag | [uk:18-329](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 6 | chicken-thigh-boiled | 195 | 180 | flag | [uk:18-319](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 7 | beef-lean-raw | 146.437 | 139 | flag | [uk:18-006](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 8 | beef-lean-cooked | 216 | 225 | ok | [uk:18-008](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 9 | beef-ground-10-fat-raw | 190.135 | 176 | flag | [sr:174030](https://fdc.nal.usda.gov/food-details/174030/nutrients) |
| 10 | beef-ground-10-fat-cooked | 217 | 209 | flag | [uk:18-470](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 11 | beef-ground-20-fat-raw | 247.813 | 254 | ok | [sr:174036](https://fdc.nal.usda.gov/food-details/174036/nutrients) |
| 12 | beef-ground-20-fat-cooked | 270 | 264 | flag | [uk:18-042](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 13 | beef-liver-raw | 135 | 155 | flag | [uk:18-415](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 14 | liver-beef-cooked | 191 | 198 | flag | [uk:18-416](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 15 | tilapia-raw | 99.957 | 96 | flag | [sr:175176](https://fdc.nal.usda.gov/food-details/175176/nutrients) |
| 16 | tilapia-grilled | 128 | 150 | flag | [uk:16-096](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 17 | sea-bass-raw | 97 | 168 | flag | [uk:16-385](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 18 | sea-bass-grilled | 124 | 154 | flag | [uk:16-386](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 19 | mullet-raw | 117 | 115 | flag | [uk:16-095](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 20 | mackerel-raw | 205 | 233 | flag | [uk:16-393](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 21 | mackerel-grilled | 262 | 283 | flag | [uk:16-394](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 22 | tuna-canned-water | 90 | 86 | flag | [sr:173709](https://fdc.nal.usda.gov/food-details/173709/nutrients) |
| 23 | tuna-canned-oil | 198 | 159 | flag | [uk:16-417](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 24 | shrimp-cooked | 99 | 102 | ok | [uk:16-388](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 25 | fish-grilled | 128 | 150 | flag | [uk:16-096](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 26 | egg-raw | 148 | 143 | ok | [sr:171287](https://fdc.nal.usda.gov/food-details/171287/nutrients) |
| 27 | egg-boiled | 155 | 143 | ok | [uk:12-940](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 28 | egg-white | 55 | 52 | flag | [sr:172183](https://fdc.nal.usda.gov/food-details/172183/nutrients) |
| 29 | milk-full-fat | 60 | 63 | ok | [uk:12-596](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 30 | milk-low-fat | 43 | 41 | ok | [uk:12-512](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 31 | milk-skimmed | 34 | 34 | ok | [uk:12-307](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 32 | yogurt-plain | 77.319 | 61 | flag | [sr:171284](https://fdc.nal.usda.gov/food-details/171284/nutrients) |
| 33 | yogurt-greek | 94.507 | 97 | ok | [sr:171304](https://fdc.nal.usda.gov/food-details/171304/nutrients) |
| 34 | labneh | 94.507 | 151.33 | flag | [custom:labneh](https://www.journalofdairyscience.org/article/S0022030212000045/pdf) |
| 35 | domiati-cheese | 273.473 | 250 | flag | [uk:12-525](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 36 | feta-cheese | 273.473 | 265 | flag | [sr:173420](https://fdc.nal.usda.gov/food-details/173420/nutrients) |
| 37 | rumi-cheese | 387 | 324.65 | flag | [custom:rumi](https://ejfs.journals.ekb.eg/article_328053_135b62aeabeb84b1c010124cf19c7d3a.pdf) |
| 38 | cottage-cheese | 84 | 81 | flag | [sr:172182](https://fdc.nal.usda.gov/food-details/172182/nutrients) |
| 39 | rice-white-raw | 369.637 | 365 | ok | [sr:169756](https://fdc.nal.usda.gov/food-details/169756/nutrients) |
| 40 | rice-white-cooked | 130 | 131 | ok | [uk:11-862](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 41 | rice-brown-dry | 368.358 | 367 | ok | [sr:169703](https://fdc.nal.usda.gov/food-details/169703/nutrients) |
| 42 | rice-brown-cooked | 123 | 132 | ok | [uk:11-869](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 43 | pasta-dry | 371 | 343 | flag | [uk:11-716](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 44 | pasta-cooked | 158 | 141 | flag | [uk:11-722](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 45 | oats-dry | 379 | 381 | flag | [uk:11-788](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 46 | oats-cooked | 71 | 47 | flag | [uk:11-1107](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 47 | bread-baladi | 262 | 261.134 | flag | [custom:baladi](https://www.nature.com/articles/s41598-023-48686-1) |
| 48 | bread-toast-white | 270 | 219 | flag | [uk:11-980](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 49 | bread-toast-whole-wheat | 254 | 217 | flag | [uk:11-981](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 50 | potato-boiled | 86 | 74 | flag | [uk:13-490](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 51 | potato-baked | 93 | 97 | ok | [uk:13-491](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 52 | sweet-potato-baked | 90 | 115 | flag | [uk:13-672](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 53 | sweet-potato-boiled | 76 | 58 | flag | [uk:13-646](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 54 | fava-beans-dry | 341 | 245 | flag | [uk:13-067](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 55 | ful-medames | 110 | 87 | flag | [old:13-069](https://assets.publishing.service.gov.uk/media/60538ba4e90e07527f645f88/CoFID_oldFoods.xlsx) |
| 56 | ful-with-oil | 116 | 148.7 | flag | [custom:ful-oil](https://fdc.nal.usda.gov/food-details/173753/nutrients) |
| 57 | lentils-brown-dry | 350.933 | 352 | flag | [sr:172420](https://fdc.nal.usda.gov/food-details/172420/nutrients) |
| 58 | lentils-cooked | 116 | 92 | flag | [uk:13-661](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 59 | chickpeas-dry | 371.995 | 378 | flag | [sr:173756](https://fdc.nal.usda.gov/food-details/173756/nutrients) |
| 60 | chickpeas-cooked | 164 | 129 | flag | [uk:13-662](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 61 | tomato | 18 | 14 | flag | [uk:13-517](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 62 | cucumber | 15 | 14 | flag | [uk:13-523](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 63 | lettuce | 15 | 11 | flag | [uk:13-520](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 64 | carrot | 44.979 | 41 | ok | [sr:170393](https://fdc.nal.usda.gov/food-details/170393/nutrients) |
| 65 | onion-raw | 40 | 35 | flag | [uk:13-499](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 66 | broccoli-cooked | 35 | 28 | flag | [uk:13-503](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 67 | zucchini-cooked | 15 | 15 | ok | [uk:13-628](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 68 | spinach-cooked | 23 | 19 | flag | [uk:13-573](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 69 | bell-pepper-green-raw | 19.692 | 20 | ok | [sr:170427](https://fdc.nal.usda.gov/food-details/170427/nutrients) |
| 70 | eggplant-raw | 22.359 | 25 | flag | [sr:169228](https://fdc.nal.usda.gov/food-details/169228/nutrients) |
| 71 | apple | 52 | 51 | flag | [uk:14-319](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 72 | banana | 97 | 89 | ok | [sr:173944](https://fdc.nal.usda.gov/food-details/173944/nutrients) |
| 73 | orange | 47 | 36 | flag | [uk:14-327](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 74 | strawberries | 31 | 32 | ok | [sr:167762](https://fdc.nal.usda.gov/food-details/167762/nutrients) |
| 75 | watermelon | 30 | 31 | ok | [uk:14-296](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 76 | mango | 60 | 48 | flag | [uk:14-378](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 77 | guava-raw | 68 | 26 | flag | [uk:14-118](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 78 | grapes-raw | 69 | 65 | ok | [uk:14-350](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 79 | cantaloupe-raw | 34 | 34 | ok | [sr:169092](https://fdc.nal.usda.gov/food-details/169092/nutrients) |
| 80 | pomegranate-raw | 83 | 51 | flag | [uk:14-226](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 81 | dates | 282 | 235 | flag | [uk:14-394](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 82 | dates-medjool | 277 | 235 | flag | [uk:14-394](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 83 | olive-oil | 884 | 899 | ok | [uk:17-038](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 84 | ghee | 900 | 878 | ok | [uk:17-640](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 85 | butter-salted | 717 | 744 | ok | [uk:17-685](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) |
| 86 | tahini | 648.374 | 595 | flag | [sr:170189](https://fdc.nal.usda.gov/food-details/170189/nutrients) |
| 87 | peanut-butter | 589.383 | 588 | ok | [sr:174294](https://fdc.nal.usda.gov/food-details/174294/nutrients) |
| 88 | almonds | 583.597 | 579 | ok | [sr:170567](https://fdc.nal.usda.gov/food-details/170567/nutrients) |
| 89 | walnuts | 678.664 | 654 | flag | [sr:170187](https://fdc.nal.usda.gov/food-details/170187/nutrients) |
| 90 | whey-protein | 352 | 409.178 | flag | [custom:whey](https://www.mdpi.com/2072-6643/10/9/1178) |

The ful-with-oil number is an ingredient sensitivity scenario. Labneh, Ras and baladi comparator kcal are calculated, not published energy measurements. Tilapia cooked uses a different-species screen and remains unresolved. See the detail rows before using any value.

## All five nutrients and food matches

Each cell is **our / other**. Nutrients are g/100 g; kcal are in the summary. Sources/food codes link to the exact dataset or publication. These are only the selected numerical comparisons, not copied source tables.

| Slug | Protein | Carbs | Fat | Total fibre | Reference food / limitations |
|---|---:|---:|---:|---:|---|
| chicken-breast-raw | 22.525 / 22.5 | 0 / 0 | 1.934 / 2.62 | 0 / 0 | [sr:171077](https://fdc.nal.usda.gov/food-details/171077/nutrients) Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw. Independent CoFID total-fibre check replaces the circular SR fallback: 18-290, Chicken, light meat, raw, 0 g AOAC fibre. https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx |
| chicken-breast-grilled | 30.54 / 32 | 0 / 0 | 3.17 / 2.2 | 0 / 0 | [uk:18-323](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Chicken, breast, grilled without skin, meat only.  |
| chicken-breast-boiled | 28.98 / 28.4 | 0 / 0 | 3.03 / 5.2 | 0 / 0 | [uk:18-307](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Chicken, breast, casseroled, meat only.  |
| chicken-thigh-raw | 18.613 / 19.66 | 0 / 0 | 7.916 / 4.12 | 0 / 0 | [sr:173627](https://fdc.nal.usda.gov/food-details/173627/nutrients) Chicken, broilers or fryers, dark meat, thigh, meat only, raw. Independent CoFID total-fibre check replaces the circular SR fallback: 18-289, Chicken, dark meat, raw, 0 g AOAC fibre. https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx |
| chicken-thigh-grilled | 24.76 / 24.4 | 0 / 0 | 8.15 / 10.9 | 0 / 0 | [uk:18-329](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Chicken, dark meat, roasted.  |
| chicken-thigh-boiled | 25 / 25.6 | 0 / 0 | 9.79 / 8.6 | 0 / unknown | [uk:18-319](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Chicken, thighs, casseroled, meat only, diced. CoFID NSP is explicitly 0; AOAC total dietary fibre is unavailable. Zero-NSP screen only, not an independently reported TDF value. |
| beef-lean-raw | 21.475 / 21.8 | 0.852 / 0 | 5.703 / 5.7 | 0 / unknown | [uk:18-006](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Beef, braising steak, raw, lean. CoFID NSP is explicitly 0; AOAC total dietary fibre is unavailable. Zero-NSP screen only, not an independently reported TDF value. |
| beef-lean-cooked | 30.54 / 34.4 | 0 / 0 | 10.46 / 9.7 | 0 / 0 | [uk:18-008](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Beef, braising steak, braised, lean only.  |
| beef-ground-10-fat-raw | 18.156 / 20 | 0 / 0 | 12.85 / 10 | 0 / 0 | [sr:174030](https://fdc.nal.usda.gov/food-details/174030/nutrients) Beef, ground, 90% lean meat / 10% fat, raw. Independent CoFID total-fibre check replaces the circular SR fallback: 18-469, Beef, mince, raw, 0 g AOAC fibre. https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx |
| beef-ground-10-fat-cooked | 26.11 / 21.8 | 0 / 0 | 11.75 / 13.5 | 0 / 0 | [uk:18-470](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Beef, mince, stewed.  |
| beef-ground-20-fat-raw | 17.531 / 17.17 | 0 / 0 | 19.44 / 20 | 0 / 0 | [sr:174036](https://fdc.nal.usda.gov/food-details/174036/nutrients) Beef, ground, 80% lean meat / 20% fat, raw. Independent CoFID total-fibre check replaces the circular SR fallback: 18-469, Beef, mince, raw, 0 g AOAC fibre. https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx |
| beef-ground-20-fat-cooked | 25.75 / 29.6 | 0 / 0 | 17.78 / 16.2 | 0 / unknown | [uk:18-042](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Beef, mince patties, barbecued. CoFID NSP is explicitly 0; AOAC total dietary fibre is unavailable. Zero-NSP screen only, not an independently reported TDF value. |
| beef-liver-raw | 20.36 / 21.1 | 3.89 / 0 | 3.63 / 7.8 | 0 / unknown | [uk:18-415](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Liver, ox, raw. CoFID NSP is explicitly 0; AOAC total dietary fibre is unavailable. Zero-NSP screen only, not an independently reported TDF value. |
| liver-beef-cooked | 29.08 / 24.8 | 5.13 / 3.6 | 5.26 / 9.5 | 0 / 0 | [uk:18-416](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Liver, ox, stewed.  |
| tilapia-raw | 19 / 20.08 | 0 / 0 | 2.479 / 1.7 | 0 / 0 | [sr:175176](https://fdc.nal.usda.gov/food-details/175176/nutrients) Fish, tilapia, raw. Seed fibre already comes from this same SR fallback. The fibre comparison is circular and does not count as independent. |
| tilapia-grilled | 26.15 / 25.7 | 0 / 0 | 2.65 / 5.2 | 0 / unknown | [uk:16-096](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Mullet, Grey, flesh only, grilled. CoFID NSP is explicitly 0; AOAC total dietary fibre is unavailable. Zero-NSP screen only, not an independently reported TDF value. |
| sea-bass-raw | 18.43 / 20 | 0 / 0 | 2 / 9.8 | 0 / 0 | [uk:16-385](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Bass, sea, flesh only, raw.  |
| sea-bass-grilled | 23.63 / 23.2 | 0 / 0 | 2.56 / 6.8 | 0 / 0 | [uk:16-386](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Bass, sea, flesh only, baked.  |
| mullet-raw | 19.35 / 19.8 | 0 / 0 | 3.79 / 4 | 0 / unknown | [uk:16-095](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Mullet, Grey, flesh only, raw. CoFID NSP is explicitly 0; AOAC total dietary fibre is unavailable. Zero-NSP screen only, not an independently reported TDF value. |
| mackerel-raw | 18.6 / 18 | 0 / 0 | 13.89 / 17.9 | 0 / 0 | [uk:16-393](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Mackerel, flesh only, raw.  |
| mackerel-grilled | 23.85 / 20.3 | 0 / 0 | 17.81 / 22.4 | 0 / 0 | [uk:16-394](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Mackerel, flesh only, grilled.  |
| tuna-canned-water | 19 / 19.44 | 0.08 / 0 | 0.94 / 0.96 | 0 / 0 | [sr:173709](https://fdc.nal.usda.gov/food-details/173709/nutrients) Fish, tuna, light, canned in water, drained solids (Includes foods for USDA's Food Distribution Program). Seed fibre already comes from this same SR fallback. The fibre comparison is circular and does not count as independent. |
| tuna-canned-oil | 29.13 / 25.4 | 0 / 0 | 8.21 / 6.4 | 0 / 0 | [uk:16-417](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Tuna, canned in sunflower oil, drained.  |
| shrimp-cooked | 23.98 / 23.5 | 0.2 / 0 | 0.28 / 0.9 | 0 / 0 | [uk:16-388](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Prawns, king, grilled from raw.  |
| fish-grilled | 26.15 / 25.7 | 0 / 0 | 2.65 / 5.2 | 0 / unknown | [uk:16-096](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Mullet, Grey, flesh only, grilled. CoFID NSP is explicitly 0; AOAC total dietary fibre is unavailable. Zero-NSP screen only, not an independently reported TDF value. |
| egg-raw | 12.4 / 12.56 | 0.96 / 0.72 | 9.96 / 9.51 | 0 / 0 | [sr:171287](https://fdc.nal.usda.gov/food-details/171287/nutrients) Egg, whole, raw, fresh.  |
| egg-boiled | 12.58 / 14.1 | 1.12 / 0 | 10.61 / 9.6 | 0 / 0 | [uk:12-940](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Eggs, chicken, whole, boiled.  |
| egg-white | 10.7 / 10.9 | 2.36 / 0.73 | 0 / 0.17 | 0 / 0 | [sr:172183](https://fdc.nal.usda.gov/food-details/172183/nutrients) Egg, white, raw, fresh. Independent CoFID total-fibre check replaces the circular SR fallback: 12-938, Eggs, chicken, white, raw, 0 g AOAC fibre. https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx |
| milk-full-fat | 3.28 / 3.4 | 4.67 / 4.6 | 3.2 / 3.6 | 0 / 0 | [uk:12-596](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Milk, whole, pasteurised, average.  |
| milk-low-fat | 3.38 / 3.5 | 5.19 / 4.8 | 0.95 / 1 | 0 / 0 | [uk:12-512](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Milk, 1% fat, pasteurised.  |
| milk-skimmed | 3.43 / 3.5 | 4.89 / 4.8 | 0.08 / 0.3 | 0 / 0 | [uk:12-307](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Milk, skimmed, pasteurised, average.  |
| yogurt-plain | 3.824 / 3.47 | 5.575 / 4.66 | 4.484 / 3.25 | 0 / 0 | [sr:171284](https://fdc.nal.usda.gov/food-details/171284/nutrients) Yogurt, plain, whole milk. Independent CoFID total-fibre check replaces the circular SR fallback: 12-184, Yogurt, whole milk, plain, 0 g AOAC fibre. https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx |
| yogurt-greek | 8.779 / 9 | 4.754 / 3.98 | 4.394 / 5 | 0 / 0 | [sr:171304](https://fdc.nal.usda.gov/food-details/171304/nutrients) Yogurt, Greek, plain, whole milk. Independent CoFID total-fibre check replaces the circular SR fallback: 12-555, Yogurt, Greek style, plain, 0 g AOAC fibre. https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx |
| labneh | 8.779 / 8.63 | 4.754 / 6.14 | 4.394 / 10.25 | 0 / 0 | [custom:labneh](https://www.journalofdairyscience.org/article/S0022030212000045/pdf) Bovine full-fat labneh, independently assayed full-fat means; energy calculated 4/4/9; fibre separately corroborated in unsupplemented control.  |
| domiati-cheese | 19.708 / 15.6 | 5.583 / 1.5 | 19.08 / 20.2 | 0 / 0 | [uk:12-525](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Cheese, Feta.  |
| feta-cheese | 19.708 / 14.21 | 5.583 / 3.88 | 19.08 / 21.49 | 0 / 0 | [sr:173420](https://fdc.nal.usda.gov/food-details/173420/nutrients) Cheese, feta. Independent CoFID total-fibre check replaces the circular SR fallback: 12-525, Cheese, Feta, 0 g AOAC fibre. https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx |
| rumi-cheese | 31.8 / 22.16 | 3.63 / 1.29 | 26.94 / 25.65 | 0 / unknown | [custom:rumi](https://ejfs.journals.ekb.eg/article_328053_135b62aeabeb84b1c010124cf19c7d3a.pdf) Egyptian Ras cheese ingredient, as-is composition; kcal calculated 4/4/9; fibre not reported.  |
| cottage-cheese | 11 / 10.45 | 4.31 / 4.76 | 2.3 / 2.27 | 0 / 0 | [sr:172182](https://fdc.nal.usda.gov/food-details/172182/nutrients) Cheese, cottage, lowfat, 2% milkfat. Independent CoFID total-fibre check replaces the circular SR fallback: 12-550, Cheese, cottage, plain, reduced fat, 0 g AOAC fibre. https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx |
| rice-white-raw | 7.039 / 7.13 | 80.313 / 79.95 | 1.033 / 0.66 | 0.149 / 1.3 | [sr:169756](https://fdc.nal.usda.gov/food-details/169756/nutrients) Rice, white, long-grain, regular, raw, unenriched.  |
| rice-white-cooked | 2.69 / 2.8 | 28.17 / 31.1 | 0.28 / 0.4 | 0.4 / 0.5 | [uk:11-862](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Rice, white, long grain, boiled in unsalted water.  |
| rice-brown-dry | 7.253 / 7.54 | 76.688 / 76.25 | 3.306 / 3.2 | 3.021 / 3.6 | [sr:169703](https://fdc.nal.usda.gov/food-details/169703/nutrients) Rice, brown, long-grain, raw (Includes foods for USDA's Food Distribution Program).  |
| rice-brown-cooked | 2.74 / 3.6 | 25.58 / 29.2 | 0.97 / 0.9 | 1.6 / 1.5 | [uk:11-869](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Rice, brown, wholegrain, boiled in unsalted water.  |
| pasta-dry | 13.04 / 11.3 | 74.67 / 75.6 | 1.51 / 1.6 | 3.2 / unknown | [uk:11-716](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Pasta, white, dried, raw.  |
| pasta-cooked | 5.8 / 4.4 | 30.86 / 31.5 | 0.93 / 0.6 | 1.8 / 1.7 | [uk:11-722](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Pasta, white, spaghetti, dried, boiled in unsalted water.  |
| oats-dry | 13.15 / 10.9 | 67.7 / 70.7 | 6.52 / 8.1 | 10.1 / 7.8 | [uk:11-788](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Porridge oats, unfortified.  |
| oats-cooked | 2.54 / 1.4 | 12 / 8.8 | 1.52 / 1 | 1.7 / 1 | [uk:11-1107](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Porridge, made with water.  |
| bread-baladi | 9.8 / 7.596 | 55.89 / 55.841 | 1.71 / 1.061 | 6.1 / unknown | [custom:baladi](https://www.nature.com/articles/s41598-023-48686-1) Egyptian baladi control, 82% extraction wheat; dry-to-as-eaten conversion; kcal calculated; total dietary fibre unavailable.  |
| bread-toast-white | 9.43 / 7.9 | 49.2 / 46.1 | 3.59 / 1.6 | 2.3 / 2.5 | [uk:11-980](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Bread, white, sliced.  |
| bread-toast-whole-wheat | 12.3 / 9.4 | 43.1 / 42 | 3.55 / 2.5 | 6 / 7 | [uk:11-981](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Bread, wholemeal, average.  |
| potato-boiled | 1.71 / 1.8 | 20.01 / 17.5 | 0.1 / 0.1 | 1.8 / 1.6 | [uk:13-490](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Potatoes, old, boiled in unsalted water, flesh only.  |
| potato-baked | 2.5 / 2.5 | 21.15 / 22.6 | 0.13 / 0.2 | 2.2 / 2.6 | [uk:13-491](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Potatoes, old, baked, flesh and skin.  |
| sweet-potato-baked | 2.01 / 1.6 | 20.71 / 27.9 | 0.15 / 0.4 | 3.3 / 5.2 | [uk:13-672](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Sweet potato, baked.  |
| sweet-potato-boiled | 1.37 / 1.7 | 17.72 / 13 | 0.14 / 0.2 | 2.5 / 2.7 | [uk:13-646](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Sweet potato, flesh only, boiled in unsalted water.  |
| fava-beans-dry | 26.12 / 26.1 | 58.29 / 32.5 | 1.53 / 2.1 | 25 / unknown | [uk:13-067](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Beans, broad, dried, raw.  |
| ful-medames | 7.6 / 8.3 | 19.65 / 12.7 | 0.4 / 0.7 | 5.4 / unknown | [old:13-069](https://assets.publishing.service.gov.uk/media/60538ba4e90e07527f645f88/CoFID_oldFoods.xlsx) Beans, broad, canned, re-heated, drained.  |
| ful-with-oil | 5.3 / 7.22 | 14.2 / 18.667 | 4.2 / 5.38 | 3.5 / 5.13 | [custom:ful-oil](https://fdc.nal.usda.gov/food-details/173753/nutrients) Calculated sensitivity recipe: 95 g boiled mature fava beans plus 5 g olive oil, final mass 100 g.  |
| lentils-brown-dry | 23.569 / 24.63 | 62.171 / 63.35 | 1.925 / 1.06 | 10.7 / 10.7 | [sr:172420](https://fdc.nal.usda.gov/food-details/172420/nutrients) Lentils, raw. Seed fibre already comes from this same SR fallback. The fibre comparison is circular and does not count as independent. |
| lentils-cooked | 9.02 / 7.8 | 20.13 / 14.5 | 0.38 / 0.7 | 7.9 / 7.4 | [uk:13-661](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Lentils, green and brown, whole, dried, boiled in unsalted water.  |
| chickpeas-dry | 21.275 / 20.47 | 60.358 / 62.95 | 6.274 / 6.04 | 12.2 / 12.2 | [sr:173756](https://fdc.nal.usda.gov/food-details/173756/nutrients) Chickpeas (garbanzo beans, bengal gram), mature seeds, raw. Seed fibre already comes from this same SR fallback. The fibre comparison is circular and does not count as independent. |
| chickpeas-cooked | 8.86 / 8.4 | 27.42 / 18.3 | 2.59 / 3 | 7.6 / 10.6 | [uk:13-662](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Beans, chick peas, Kabuli, whole, dried, boiled in unsalted water.  |
| tomato | 0.88 / 0.5 | 3.89 / 3 | 0.2 / 0.1 | 1.2 / 1 | [uk:13-517](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Tomatoes, standard, raw.  |
| cucumber | 0.65 / 1 | 3.63 / 1.2 | 0.11 / 0.6 | 0.5 / 0.7 | [uk:13-523](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Cucumber, raw, flesh and skin.  |
| lettuce | 1.36 / 1.2 | 2.87 / 1.4 | 0.15 / 0.1 | 1.3 / 1.5 | [uk:13-520](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Lettuce, average, raw.  |
| carrot | 0.941 / 0.93 | 10.268 / 9.58 | 0.351 / 0.24 | 3.095 / 2.8 | [sr:170393](https://fdc.nal.usda.gov/food-details/170393/nutrients) Carrots, raw.  |
| onion-raw | 1.1 / 1 | 9.34 / 8 | 0.1 / 0.1 | 1.7 / 2.2 | [uk:13-499](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Onions, raw.  |
| broccoli-cooked | 2.38 / 3.3 | 7.18 / 2.8 | 0.41 / 0.5 | 3.3 / 2.8 | [uk:13-503](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Broccoli, green, boiled in unsalted water.  |
| zucchini-cooked | 1.14 / 1.3 | 2.69 / 1.8 | 0.36 / 0.3 | 1 / 0.8 | [uk:13-628](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Courgette, boiled in unsalted water.  |
| spinach-cooked | 2.97 / 2.2 | 3.75 / 0.8 | 0.26 / 0.8 | 2.4 / 2.421 | [uk:13-573](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Spinach, mature, boiled in unsalted water. Supplementary Canadian total fibre: Spinach, boiled, drained; 2.3 g fibre / 95 g. CNF may share USDA ancestry; not a claimed independent laboratory replicate. https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html |
| bell-pepper-green-raw | 0.715 / 0.86 | 4.778 / 4.64 | 0.106 / 0.17 | 0.942 / 1.7 | [sr:170427](https://fdc.nal.usda.gov/food-details/170427/nutrients) Peppers, sweet, green, raw.  |
| eggplant-raw | 0.852 / 0.98 | 5.399 / 5.88 | 0.12 / 0.18 | 2.448 / 3 | [sr:169228](https://fdc.nal.usda.gov/food-details/169228/nutrients) Eggplant, raw.  |
| apple | 0.26 / 0.6 | 13.81 / 11.6 | 0.17 / 0.5 | 2.4 / 1.2 | [uk:14-319](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Apples, eating, raw, flesh and skin.  |
| banana | 0.74 / 1.09 | 23 / 22.84 | 0.29 / 0.33 | 1.7 / 2.6 | [sr:173944](https://fdc.nal.usda.gov/food-details/173944/nutrients) Bananas, raw.  |
| orange | 0.94 / 0.8 | 11.75 / 8.2 | 0.12 / 0.2 | 2.4 / 1.2 | [uk:14-327](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Oranges, flesh only.  |
| strawberries | 0.64 / 0.67 | 7.63 / 7.68 | 0.22 / 0.3 | 1.8 / 2 | [sr:167762](https://fdc.nal.usda.gov/food-details/167762/nutrients) Strawberries, raw.  |
| watermelon | 0.61 / 0.5 | 7.55 / 7.1 | 0.15 / 0.3 | 0.4 / 0.375 | [uk:14-296](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Melon, watermelon, flesh only. Supplementary Canadian total fibre: Melon, watermelon, cubes; 0.3 g fibre / 80 g. CNF may share USDA ancestry; not a claimed independent laboratory replicate. https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html |
| mango | 0.82 / 0.7 | 14.98 / 10.7 | 0.38 / 0.6 | 1.6 / 1.1 | [uk:14-378](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Mangoes, ripe, flesh only, raw.  |
| guava-raw | 2.55 / 0.8 | 14.32 / 5 | 0.95 / 0.5 | 5.4 / unknown | [uk:14-118](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Guava, flesh only, raw.  |
| grapes-raw | 0.72 / 0.7 | 18.1 / 16.1 | 0.16 / 0.2 | 0.9 / 1.3 | [uk:14-350](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Grapes, average.  |
| cantaloupe-raw | 0.82 / 0.84 | 8.16 / 8.16 | 0.18 / 0.19 | 0.8 / 0.9 | [sr:169092](https://fdc.nal.usda.gov/food-details/169092/nutrients) Melons, cantaloupe, raw.  |
| pomegranate-raw | 1.67 / 1.3 | 18.7 / 11.8 | 1.17 / 0.2 | 4 / 0.649 | [uk:14-226](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Pomegranate, flesh and pips. Supplementary Canadian total fibre: Pomegranate, 1/2 fruit; 0.5 g fibre / 77 g. CNF may share USDA ancestry; not a claimed independent laboratory replicate. https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html |
| dates | 2.45 / 2.4 | 75.03 / 58.7 | 0.39 / 0.6 | 8 / 7.5 | [uk:14-394](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Dates, dried, flesh and skin.  |
| dates-medjool | 1.81 / 2.4 | 74.97 / 58.7 | 0.15 / 0.6 | 6.7 / 7.5 | [uk:14-394](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Dates, dried, flesh and skin.  |
| olive-oil | 0 / 0 | 0 / 0 | 100 / 99.9 | 0 / 0 | [uk:17-038](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Oil, olive.  |
| ghee | 0 / 0.1 | 0 / 0 | 100 / 97.6 | 0 / 0 | [uk:17-640](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Ghee, butter.  |
| butter-salted | 0.85 / 0.6 | 0.06 / 0.6 | 81.11 / 82.2 | 0 / 0 | [uk:17-685](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx) Butter, salted.  |
| tahini | 19.705 / 17 | 14.179 / 21.19 | 62.4 / 53.76 | 8.372 / 9.3 | [sr:170189](https://fdc.nal.usda.gov/food-details/170189/nutrients) Seeds, sesame butter, tahini, from roasted and toasted kernels (most common type).  |
| peanut-butter | 23.991 / 21.93 | 22.704 / 23.98 | 49.43 / 49.54 | 6.323 / 5.7 | [sr:174294](https://fdc.nal.usda.gov/food-details/174294/nutrients) Peanut Butter, smooth (Includes foods for USDA's Food Distribution Program).  |
| almonds | 21.45 / 21.15 | 20.035 / 21.55 | 51.09 / 49.93 | 10.78 / 12.5 | [sr:170567](https://fdc.nal.usda.gov/food-details/170567/nutrients) Nuts, almonds.  |
| walnuts | 14.564 / 15.23 | 10.91 / 13.71 | 69.74 / 65.21 | 5.21 / 6.7 | [sr:170187](https://fdc.nal.usda.gov/food-details/170187/nutrients) Nuts, walnuts, english.  |
| whey-protein | 78.13 / 78.2 | 6.25 / 7.9 | 1.56 / 6.72 | 3.1 / <0.5 (screen bound 0.5) | [custom:whey](https://www.mdpi.com/2072-6643/10/9/1178) Independently assayed WPC-80; kcal converted from 1712 kJ; fibre upper bound <0.5 g, displayed as 0.5 for conservative screening.  |

Additional independent drained-tuna comparison: **90 / 109 kcal, 19 / 24.9 g protein, 0.08 / 0 g carbs, 0.94 / 1 g fat, 0 / 0 g fibre**, CoFID **16-416**, drained brine. This crosses energy/protein thresholds despite agreement with SR 86 kcal. [CoFID workbook](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

## Every flagged food explained

### chicken-breast-boiled

CoFID meat-only casseroled chicken is a moist-heat proxy, not plain boiled-and-drained breast. Fat can reflect skin exposure and cooking losses. Confirm the actual cooking protocol before changing numbers. Second reference: [uk:18-307](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `fat_g_per_100g`: 3.03 versus 5.2; -41.73%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### chicken-thigh-raw

Same skinless raw cut, but Foundation fat 7.916 g is 92% above SR 4.12 g. Analytical trimming/sample differences are plausible; no copy error was found. Specify trimming and avoid representing this as a precise universal value. Second reference: [sr:173627](https://fdc.nal.usda.gov/food-details/173627/nutrients).

- `calories_kcal_per_100g`: 149.306 versus 121; +23.39%.
- `fat_g_per_100g`: 7.916 versus 4.12; +92.14%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### chicken-thigh-grilled

CoFID roasted dark meat is broader than thigh alone, while the seed already uses roasted thigh for grilled. Fat differences are a proxy/cut sensitivity, not proof of a decimal error. Second reference: [uk:18-329](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `fat_g_per_100g`: 8.15 versus 10.9; -25.23%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### chicken-thigh-boiled

CoFID casseroled diced thigh is only a moist-heat proxy; no independent plain-boiled exact match was obtained. Second reference: [uk:18-319](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `fiber_g_per_100g`: 0 versus unknown; percentage undefined/not applicable.
  CoFID NSP is explicitly 0; AOAC total dietary fibre is unavailable. Zero-NSP screen only, not an independently reported TDF value.

Action: Resolve the missing independent evidence and calibrate household measures; retain the record as unverified.

### beef-lean-raw

UK braising steak versus US top round is a different cut. The low nonzero Foundation carbohydrate is a by-difference result, not evidence of added starch. Second reference: [uk:18-006](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `fiber_g_per_100g`: 0 versus unknown; percentage undefined/not applicable.
  CoFID NSP is explicitly 0; AOAC total dietary fibre is unavailable. Zero-NSP screen only, not an independently reported TDF value.

Action: Resolve the missing independent evidence and calibrate household measures; retain the record as unverified.

### beef-ground-10-fat-raw

The nominal 10%-fat item contains 12.85 g measured fat per 100 g, versus SR 10 g. That is a material identity/label precision problem even though extraction faithfully matches Foundation. Use a declared-fat product or describe the sampled composition honestly. Second reference: [sr:174030](https://fdc.nal.usda.gov/food-details/174030/nutrients).

- `fat_g_per_100g`: 12.85 versus 10; +28.50%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### beef-ground-10-fat-cooked

UK generic stewed mince has unspecified starting fat and a different cooking method from the seed broiled patty. This is a weak comparator; its protein discrepancy cannot establish that the seed is wrong. Second reference: [uk:18-470](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `protein_g_per_100g`: 26.11 versus 21.8; +19.77%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### beef-ground-20-fat-cooked

UK barbecued mince patties have unspecified initial fat. Reasonable cooking-form screen, not independent verification of an exact 80/20 formulation. Second reference: [uk:18-042](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `fiber_g_per_100g`: 0 versus unknown; percentage undefined/not applicable.
  CoFID NSP is explicitly 0; AOAC total dietary fibre is unavailable. Zero-NSP screen only, not an independently reported TDF value.

Action: Resolve the missing independent evidence and calibrate household measures; retain the record as unverified.

### beef-liver-raw

Both sources say raw bovine liver, but UK fat is 7.8 versus 3.63 g and UK carbohydrate is trace. These are historical sample and analytical-definition differences. Do not copy the UK zero/trace carbohydrate over the seed automatically. Second reference: [uk:18-415](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 135 versus 155; -12.90%.
- `carbs_g_per_100g`: 3.89 versus 0; percentage undefined/not applicable.
- `fat_g_per_100g`: 3.63 versus 7.8; -53.46%.
- `fiber_g_per_100g`: 0 versus unknown; percentage undefined/not applicable.
  CoFID NSP is explicitly 0; AOAC total dietary fibre is unavailable. Zero-NSP screen only, not an independently reported TDF value.

Action: Resolve the missing independent evidence and calibrate household measures; retain the record as unverified.

### liver-beef-cooked

UK stewed versus US braised liver differ materially in fat and protein. Cooking losses and residual cooking fat need a stated protocol. Second reference: [uk:18-416](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `protein_g_per_100g`: 29.08 versus 24.8; +17.26%.
- `carbs_g_per_100g`: 5.13 versus 3.6; +42.50%.
- `fat_g_per_100g`: 5.26 versus 9.5; -44.63%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### tilapia-raw

No material discrepancy in the chosen numerical screen. Food, sample and household serving sizes still vary; this is not a local portion measurement. Second reference: [sr:175176](https://fdc.nal.usda.gov/food-details/175176/nutrients).

- `fiber_independence`: 0 versus 0; percentage undefined/not applicable.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### tilapia-grilled

No independent same-species cooked tilapia composition was located in the accepted sources inspected. UK grilled grey mullet is a different-species sensitivity check only; this row is NOT independently verified for tilapia. Obtain a cooked tilapia analysis before numerical correction. Second reference: [uk:16-096](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 128 versus 150; -14.67%.
- `fat_g_per_100g`: 2.65 versus 5.2; -49.04%.
- `food_match`: Independent grilled tilapia reference unavailable; mullet comparator is a different species.
- `fiber_g_per_100g`: 0 versus unknown; percentage undefined/not applicable.
  CoFID NSP is explicitly 0; AOAC total dietary fibre is unavailable. Zero-NSP screen only, not an independently reported TDF value.

Action: Resolve the missing independent evidence and calibrate household measures; retain the record as unverified.

### sea-bass-raw

USDA mixed-species bass is much leaner than UK sea-bass samples. Species and aquaculture/wild origin matter; a US mixed-species bass match does not establish the composition of Egyptian قاروص. Obtain a species-specific match. Second reference: [uk:16-385](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 97 versus 168; -42.26%.
- `fat_g_per_100g`: 2 versus 9.8; -79.59%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### sea-bass-grilled

UK baked sea-bass flesh and the US dry-heat mixed-species bass differ in fat and energy. Baking versus grilling is an additional limitation, but neither explains away the unresolved species/sample match. Second reference: [uk:16-386](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 124 versus 154; -19.48%.
- `fat_g_per_100g`: 2.56 versus 6.8; -62.35%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### mullet-raw

No material discrepancy in the chosen numerical screen. Food, sample and household serving sizes still vary; this is not a local portion measurement. Second reference: [uk:16-095](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `fiber_g_per_100g`: 0 versus unknown; percentage undefined/not applicable.
  CoFID NSP is explicitly 0; AOAC total dietary fibre is unavailable. Zero-NSP screen only, not an independently reported TDF value.

Action: Resolve the missing independent evidence and calibrate household measures; retain the record as unverified.

### mackerel-raw

Fat varies with catch, season and species. UK measured samples are fattier. Confirm the mackerel species and season; this discrepancy alone does not establish an extraction mistake. Second reference: [uk:16-393](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 205 versus 233; -12.02%.
- `fat_g_per_100g`: 13.89 versus 17.9; -22.40%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### mackerel-grilled

UK grilled flesh versus US dry-heat mackerel differ in fat/protein and moisture concentration. Confirm species and cooking method. Second reference: [uk:16-394](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `protein_g_per_100g`: 23.85 versus 20.3; +17.49%.
- `fat_g_per_100g`: 17.81 versus 22.4; -20.49%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### tuna-canned-water

SR corroborates the low Foundation values, but an additional independent UK drained-brine sample has 109 kcal and 24.9 g protein. Neither 90 nor 116 kcal is universally correct: drainage, species and formulation must be specified. The assumed 140 g can requires a drained-weight label. Second reference: [sr:173709](https://fdc.nal.usda.gov/food-details/173709/nutrients).

- `calories_kcal_per_100g`: 90 versus 109; -17.43%.
- `protein_g_per_100g`: 19 versus 24.9; -23.69%.
- `fiber_independence`: 0 versus 0; percentage undefined/not applicable.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### tuna-canned-oil

Both are drained, but UK explicitly uses sunflower oil and the US record covers oil generically. Remaining oil and drainage change fat and calories; record drained mass and oil type. Second reference: [uk:16-417](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 198 versus 159; +24.53%.
- `fat_g_per_100g`: 8.21 versus 6.4; +28.28%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### fish-grilled

The seed is specifically tilapia, while the user-facing name is generic grilled fish. Grilled mullet has 150 kcal/5.2 g fat, compared with 128/2.65; grilled mackerel is 283/22.4 in CoFID. A universal fish record is misleading. Name the species. Second reference: [uk:16-096](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 128 versus 150; -14.67%.
- `fat_g_per_100g`: 2.65 versus 5.2; -49.04%.
- `food_match`: Generic fish label hides a tilapia-only composition.
- `fiber_g_per_100g`: 0 versus unknown; percentage undefined/not applicable.
  CoFID NSP is explicitly 0; AOAC total dietary fibre is unavailable. Zero-NSP screen only, not an independently reported TDF value.

Action: Resolve the missing independent evidence and calibrate household measures; retain the record as unverified.

### egg-white

Foundation carbohydrate 2.36 g versus SR 0.73 g crosses the absolute threshold by only 0.13 g (difference 1.63 g). Likely analytical/by-difference variation, not a demonstrated nutrient-ID error. Second reference: [sr:172183](https://fdc.nal.usda.gov/food-details/172183/nutrients).

- `carbs_g_per_100g`: 2.36 versus 0.73; +223.29%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### yogurt-plain

Both whole-milk plain yogurts, but Foundation has 4.484 g fat versus SR 3.25 g, giving 77.3 versus 61 kcal. The higher-fat sample is real; define a fat range rather than assuming all plain yogurt is interchangeable. Second reference: [sr:171284](https://fdc.nal.usda.gov/food-details/171284/nutrients).

- `calories_kcal_per_100g`: 77.319 versus 61; +26.75%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### labneh

A full-fat labneh label backed by US Greek yogurt is weak. Independently assayed full-fat labneh means give 10.25 g fat and calculated 151.33 kcal, versus 4.394 g and 94.51 kcal. Fibre zero is separately supported by an unsupplemented Egyptian labneh control. Use labneh-specific composition and declared milk/fat level. Second reference: [custom:labneh](https://www.journalofdairyscience.org/article/S0022030212000045/pdf).

- `calories_kcal_per_100g`: 94.507 versus 151.33; -37.55%.
- `fat_g_per_100g`: 4.394 versus 10.25; -57.13%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### domiati-cheese

The seed is a feta proxy, not independently measured Domiati. UK feta is a second check of the proxy only; differences in protein/carbs do not identify the correct Egyptian white cheese. Source a matching Domiati analysis, including milk and ripening. Second reference: [uk:12-525](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `protein_g_per_100g`: 19.708 versus 15.6; +26.33%.
- `carbs_g_per_100g`: 5.583 versus 1.5; +272.21%.
- `food_match`: Independent numbers only verify a feta proxy, not Domiati.

Action: Resolve the missing independent evidence and calibrate household measures; retain the record as unverified.

### feta-cheese

Foundation crumbled whole-milk feta has 19.71 g protein versus SR 14.21 g, and 5.58 versus 3.88 g carbohydrate. This is a same-food discrepancy, plausibly moisture/formulation; verify against the intended local white cheese. Second reference: [sr:173420](https://fdc.nal.usda.gov/food-details/173420/nutrients).

- `protein_g_per_100g`: 19.708 versus 14.21; +38.69%.
- `carbs_g_per_100g`: 5.583 versus 3.88; +43.90%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### rumi-cheese

The Romano proxy overstates protein versus this Egyptian Ras sample (31.8 versus 22.16 g), and energy versus calculated 324.65 kcal. One Ras sample does not define every ripening stage. Use a matching Egyptian Ras/rumi source; do not substitute these numbers without review. Second reference: [custom:rumi](https://ejfs.journals.ekb.eg/article_328053_135b62aeabeb84b1c010124cf19c7d3a.pdf).

- `calories_kcal_per_100g`: 387 versus 324.65; +19.21%.
- `protein_g_per_100g`: 31.8 versus 22.16; +43.50%.
- `carbs_g_per_100g`: 3.63 versus 1.29; +181.40%.
- `fiber_g_per_100g`: 0 versus unknown; percentage undefined/not applicable.
  The independent comparator does not report total dietary fibre. Unknown was not converted to zero.

Action: Resolve the missing independent evidence and calibrate household measures; retain the record as unverified.

### cottage-cheese

The US 2% cottage-cheese profile is corroborated by SR, but that only verifies the US proxy. It does not independently validate Egyptian kareish moisture, fat or tablespoon weight. Second reference: [sr:172182](https://fdc.nal.usda.gov/food-details/172182/nutrients).

- `food_match`: Agreement between US cottage-cheese datasets does not verify Egyptian kareish.

Action: Resolve the missing independent evidence and calibrate household measures; retain the record as unverified.

### pasta-dry

No material discrepancy in the chosen numerical screen. Food, sample and household serving sizes still vary; this is not a local portion measurement. Second reference: [uk:11-716](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `protein_g_per_100g`: 13.04 versus 11.3; +15.40%.
- `fiber_g_per_100g`: 3.2 versus unknown; percentage undefined/not applicable.
  The independent comparator does not report total dietary fibre. Unknown was not converted to zero.

Action: Resolve the missing independent evidence and calibrate household measures; retain the record as unverified.

### pasta-cooked

UK boiled spaghetti is wetter than US cooked enriched pasta. Hydration/end-point causes material kcal variation; define drained cooking state. Neither raw/dry pasta value has been substituted here. Second reference: [uk:11-722](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 158 versus 141; +12.06%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### oats-dry

UK oat samples have 10.9 g protein, 8.1 g fat and 7.8 g AOAC fibre; seed has 13.15/6.52/10.1. Product/cultivar and method differences merit review, not automatic replacement. Second reference: [uk:11-788](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `protein_g_per_100g`: 13.15 versus 10.9; +20.64%.
- `fat_g_per_100g`: 6.52 versus 8.1; -19.51%.
- `fiber_g_per_100g`: 10.1 versus 7.8; +29.49%.
- `portions[0].weight_g`: 10 versus 13.333; -25.00%.
  10 g/spoon versus BDA approximate 13.33 g/spoon. Spoon packing/heaping is unspecified in both household conventions; the seed value needs a weighed calibration. [Portion evidence](https://www.bda.uk.com/resource/food-facts-portion-sizes.html).

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### oats-cooked

Both are cooked in water, but UK porridge is more diluted (47 versus 71 kcal). A cooked-oats record needs dry weight and final yield or a standardized recipe. Second reference: [uk:11-1107](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 71 versus 47; +51.06%.
- `carbs_g_per_100g`: 12 versus 8.8; +36.36%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### bread-baladi

An actual Egyptian baladi control was used, not UK sliced bread. The paper reports protein 11.60, fat 1.62, crude fibre 1.65 and carbohydrate 83.63 on dry matter, with moisture 34.52%. Multiply by 0.6548. Our comparator carbohydrate adds crude fibre back to approximate total carbohydrate. Crude fibre is NOT total dietary fibre; the seed 6.1 g fibre remains independently unresolved. Calculated energy is an estimate, not published calorimetry. Second reference: [custom:baladi](https://www.nature.com/articles/s41598-023-48686-1).

- `protein_g_per_100g`: 9.8 versus 7.596; +29.02%.
- `fiber_g_per_100g`: 6.1 versus unknown; percentage undefined/not applicable.
  The independent comparator does not report total dietary fibre. Unknown was not converted to zero.
- `portions[0].weight_g`: 100 versus 90; +11.11%.
  100 g is a planning convention; the quoted subsidized loaf is 90 g. This is a real 11.1% mass overestimate for that loaf type, not evidence that every bakery loaf is 90 g. [Portion evidence](https://www.alwafd.news/5987906).
- `portions[1].weight_g`: 50 versus 45; +11.11%.
  The 50 g half-loaf inherits the same 100 g assumption; half of 90 g is 45 g. [Portion evidence](https://www.alwafd.news/5987906).

Action: Resolve the missing independent evidence and calibrate household measures; retain the record as unverified.

### bread-toast-white

Both records are untoasted sliced white bread, not dry toast/rusk. UK formulation has less fat/protein and 219 versus 270 kcal. The seed English description makes its state clear, but the Arabic toast name needs that clarification. Slice thickness must also be explicit. Second reference: [uk:11-980](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 270 versus 219; +23.29%.
- `protein_g_per_100g`: 9.43 versus 7.9; +19.37%.
- `fat_g_per_100g`: 3.59 versus 1.6; +124.38%.
- `portions[0].weight_g`: 27.3 versus 35; -22.00%.
  27.3 g is a thinner/smaller slice than the 35 g Canadian reference. Source weights may both be valid; a size-free slice default is not portable. [Portion evidence](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html).

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### bread-toast-whole-wheat

Both are untoasted whole-wheat/wholemeal bread, not dried toast. UK protein is lower and kcal differ; flour recipe and moisture vary. Second reference: [uk:11-981](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 254 versus 217; +17.05%.
- `protein_g_per_100g`: 12.3 versus 9.4; +30.85%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### potato-boiled

UK boiled peeled potato is 74 versus 86 kcal; water content and variety plausibly explain this. Weigh cooked edible potatoes and specify draining. Second reference: [uk:13-490](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 86 versus 74; +16.22%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### sweet-potato-baked

Same broad cooking state; UK values are more concentrated in carbohydrate/fibre. Variety and moisture vary materially; avoid one precise number for all Egyptian sweet potatoes. Second reference: [uk:13-672](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 90 versus 115; -21.74%.
- `carbs_g_per_100g`: 20.71 versus 27.9; -25.77%.
- `fiber_g_per_100g`: 3.3 versus 5.2; -36.54%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### sweet-potato-boiled

Both plain boiled flesh, but UK is wetter/lower in carbs. Verify cooked-and-drained yield and variety. Second reference: [uk:13-646](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 76 versus 58; +31.03%.
- `carbs_g_per_100g`: 17.72 versus 13; +36.31%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### fava-beans-dry

UK carbohydrate is available carbohydrate in monosaccharide equivalents; USDA carbohydrate-by-difference includes fibre. UK NSP alone is 27.6 g, while total AOAC fibre is unreported. Much of this apparent carbohydrate/energy discrepancy is definitional. Do not replace the seed with 32.5 g total carbohydrate. Second reference: [uk:13-067](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 341 versus 245; +39.18%.
- `carbs_g_per_100g`: 58.29 versus 32.5; +79.35%.
- `fiber_g_per_100g`: 25 versus unknown; percentage undefined/not applicable.
  The independent comparator does not report total dietary fibre. Unknown was not converted to zero.

Action: Resolve the missing independent evidence and calibrate household measures; retain the record as unverified.

### ful-medames

Only UK old-food canned reheated/drained broad beans were available as a second screen. Maturity is unspecified and may represent green beans rather than dried mature fava; this is NOT an exact ful match. The 87 kcal/8.3 g protein/12.7 g available carbs/0.7 g fat screen cannot validate or correct Egyptian ful. AOAC fibre absent; NSP 5.2 g is not substituted. Second reference: [old:13-069](https://assets.publishing.service.gov.uk/media/60538ba4e90e07527f645f88/CoFID_oldFoods.xlsx).

- `calories_kcal_per_100g`: 110 versus 87; +26.44%.
- `carbs_g_per_100g`: 19.65 versus 12.7; +54.72%.
- `food_match`: UK canned broad-bean maturity is unspecified; no independent exact mature cooked fava/ful match.
- `fiber_g_per_100g`: 5.4 versus unknown; percentage undefined/not applicable.
  The independent comparator does not report total dietary fibre. Unknown was not converted to zero.

Action: Resolve the missing independent evidence and calibrate household measures; retain the record as unverified.

### ful-with-oil

The Lebanese University report and the cited Hoteit paper reproduce the SAME dish numbers; they are not an independent cross-check. The second comparison is explicitly a 95:5 cooked-bean/oil scenario (148.7 kcal), not a measured Egyptian dish. Extra water or vegetables can explain the lower 116 kcal. Independent recipe-level verification is still missing; standardize beans, oil and final cooked mass. Second reference: [custom:ful-oil](https://fdc.nal.usda.gov/food-details/173753/nutrients).

- `calories_kcal_per_100g`: 116 versus 148.7; -21.99%.
- `protein_g_per_100g`: 5.3 versus 7.22; -26.59%.
- `carbs_g_per_100g`: 14.2 versus 18.667; -23.93%.
- `fiber_g_per_100g`: 3.5 versus 5.13; -31.77%.
- `food_match`: Only an independent ingredient-model sensitivity check; no independent recipe-level analysis.

Action: Resolve the missing independent evidence and calibrate household measures; retain the record as unverified.

### lentils-brown-dry

No material discrepancy in the chosen numerical screen. Food, sample and household serving sizes still vary; this is not a local portion measurement. Second reference: [sr:172420](https://fdc.nal.usda.gov/food-details/172420/nutrients).

- `fiber_independence`: 10.7 versus 10.7; +0.00%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### lentils-cooked

Both mature lentils boiled, but cooking hydration and UK available-carbohydrate versus USDA total-carbohydrate definitions contribute to the discrepancy. Second reference: [uk:13-661](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 116 versus 92; +26.09%.
- `carbs_g_per_100g`: 20.13 versus 14.5; +38.83%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### chickpeas-dry

No material discrepancy in the chosen numerical screen. Food, sample and household serving sizes still vary; this is not a local portion measurement. Second reference: [sr:173756](https://fdc.nal.usda.gov/food-details/173756/nutrients).

- `fiber_independence`: 12.2 versus 12.2; +0.00%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### chickpeas-cooked

Both mature chickpeas boiled, but hydration, fibre assay and carbohydrate definitions differ. The UK fibre comparison is independently sampled in 2017, not simply a republished USDA row. Second reference: [uk:13-662](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 164 versus 129; +27.13%.
- `carbs_g_per_100g`: 27.42 versus 18.3; +49.84%.
- `fiber_g_per_100g`: 7.6 versus 10.6; -28.30%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### tomato

No material discrepancy in the chosen numerical screen. Food, sample and household serving sizes still vary; this is not a local portion measurement. Second reference: [uk:13-517](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 18 versus 14; +28.57%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### cucumber

Most of the carbohydrate difference is UK available carbohydrate versus USDA total carbohydrate including fibre, plus sample variation. A small relative percentage in a low-carb vegetable should not be treated as a decimal error. Second reference: [uk:13-523](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `carbs_g_per_100g`: 3.63 versus 1.2; +202.50%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### lettuce

UK average lettuce and US green-leaf lettuce are not identical cultivar mixtures. The household cup packing discrepancy is more actionable than the small absolute kcal difference. Second reference: [uk:13-520](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 15 versus 11; +36.36%.
- `portions[0].weight_g`: 36 versus 55.835; -35.52%.
  36 g US cup is much lighter than the independently published approximately 55.83 g US-equivalent cup. Leaf packing and cut differ; a cup needs an explicit packing rule. [Portion evidence](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html).

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### onion-raw

Both raw onions; variety and UK available-carb basis explain plausible small kcal variation. Second reference: [uk:13-499](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 40 versus 35; +14.29%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### broccoli-cooked

Both boiled, but UK available carbohydrate omits fibre while US total includes it. Do not replace 7.18 g total carbs with 2.8 g available carbs without a basis conversion. Second reference: [uk:13-503](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 35 versus 28; +25.00%.
- `carbs_g_per_100g`: 7.18 versus 2.8; +156.43%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### spinach-cooked

UK carbohydrate excludes fibre; the large percentage is mainly a nutrient-definition issue. UK total AOAC fibre is missing; Canadian boiled-spinach fibre is used as a supplementary check. Second reference: [uk:13-573](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 23 versus 19; +21.05%.
- `carbs_g_per_100g`: 3.75 versus 0.8; +368.75%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### eggplant-raw

No material discrepancy in the chosen numerical screen. Food, sample and household serving sizes still vary; this is not a local portion measurement. Second reference: [sr:169228](https://fdc.nal.usda.gov/food-details/169228/nutrients).

- `calories_kcal_per_100g`: 22.359 versus 25; -10.57%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### apple

UK available-carb and fibre methods/samples differ from US total carbohydrate. This is a basis/sample sensitivity rather than proven food mismatch. Second reference: [uk:14-319](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `carbs_g_per_100g`: 13.81 versus 11.6; +19.05%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### orange

UK available carbohydrate and older fruit samples are lower; cultivar and edible-part definitions also matter. No evidence of a slipped decimal was found. Second reference: [uk:14-327](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 47 versus 36; +30.56%.
- `carbs_g_per_100g`: 11.75 versus 8.2; +43.29%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### mango

UK flesh-only ripe mango is lower in carbohydrate/energy. Ripeness, variety, and carbohydrate definition affect composition. A separate Canadian half-mango reference also shows the seed single-fruit default is a large mango, not a safe universal household mass. Second reference: [uk:14-378](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 60 versus 48; +25.00%.
- `carbs_g_per_100g`: 14.98 versus 10.7; +40.00%.
- `portions[0].weight_g`: 336 versus 208; +61.54%.
  336 g per fruit is 61.5% above the Canadian whole-fruit reference. Size/cultivar varies; this is a large-fruit convention, not a universal mango. A client counting one smaller mango can substantially miss the intended serving. [Portion evidence](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html).

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### guava-raw

UK guava is flesh-only, whereas USDA common raw guava includes edible skin/seeds. This is an edible-part mismatch; UK 26 kcal must NOT replace 68 kcal for whole edible guava. No compatible independent whole-edible guava AOAC fibre was found. Second reference: [uk:14-118](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 68 versus 26; +161.54%.
- `protein_g_per_100g`: 2.55 versus 0.8; +218.75%.
- `carbs_g_per_100g`: 14.32 versus 5; +186.40%.
- `fiber_g_per_100g`: 5.4 versus unknown; percentage undefined/not applicable.
  The independent comparator does not report total dietary fibre. Unknown was not converted to zero.

Action: Resolve the missing independent evidence and calibrate household measures; retain the record as unverified.

### pomegranate-raw

Edible arils/seed treatment, analytical sample, and UK carbohydrate definitions differ. Canadian supplementary fibre is much lower too, showing that edible-part/fibre method needs explicit resolution. Second reference: [uk:14-226](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 83 versus 51; +62.75%.
- `carbs_g_per_100g`: 18.7 versus 11.8; +58.47%.
- `fiber_g_per_100g`: 4 versus 0.649; +516.00%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### dates

UK generic dried dates have different moisture/cultivars and available-carbohydrate basis. Verify date type and drying stage. Second reference: [uk:14-394](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 282 versus 235; +20.00%.
- `carbs_g_per_100g`: 75.03 versus 58.7; +27.82%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### dates-medjool

UK generic dried dates are not a cultivar-specific Medjool validation. Keep Medjool distinct from small Deglet Noor dates and verify the actual pitted fruit mass. Second reference: [uk:14-394](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx).

- `calories_kcal_per_100g`: 277 versus 235; +17.87%.
- `carbs_g_per_100g`: 74.97 versus 58.7; +27.72%.
- `food_match`: Comparator is generic dried dates, not independently sourced Medjool.

Action: Resolve the missing independent evidence and calibrate household measures; retain the record as unverified.

### tahini

Foundation creamy sesame butter is fattier and lower in carbohydrate than SR roasted/toasted tahini. Hulled/unhulled kernels, roasting and separation affect composition; define the intended tahini type. Second reference: [sr:170189](https://fdc.nal.usda.gov/food-details/170189/nutrients).

- `protein_g_per_100g`: 19.705 versus 17; +15.91%.
- `carbs_g_per_100g`: 14.179 versus 21.19; -33.09%.
- `fat_g_per_100g`: 62.4 versus 53.76; +16.07%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### walnuts

Foundation fat is higher and carbohydrate lower than SR English walnuts; same broad food, plausible sample and by-difference variability. Retain source precision internally but do not imply six-decimal dietary accuracy. Second reference: [sr:170187](https://fdc.nal.usda.gov/food-details/170187/nutrients).

- `carbs_g_per_100g`: 10.91 versus 13.71; -20.43%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

### whey-protein

An independently assayed WPC-80 has 6.72 g fat, <0.5 g fibre and 409.18 kcal, versus 1.56 g, 3.1 g and 352 kcal in the generic whey-based beverage powder. These are different formulations. Use an actual label/product or a defined concentrate/isolate class; keep the 30 g serving explicitly weighed. Second reference: [custom:whey](https://www.mdpi.com/2072-6643/10/9/1178).

- `calories_kcal_per_100g`: 352 versus 409.178; -13.97%.
- `carbs_g_per_100g`: 6.25 versus 7.9; -20.89%.
- `fat_g_per_100g`: 1.56 versus 6.72; -76.79%.
- `fiber_g_per_100g`: 3.1 versus 0.5; +520.00%.

Action: Review the stated sample, food identity and analytical basis; do not automatically overwrite with the second value.

## Portion audit

All household measures in the 90 selected records were inspected. Independent numerical checks obtained are below, including non-default measures. Other household masses remain assumptions or primary-source-only references; absence of a contradiction is not a verified portion. Volume normalization uses 236.5882365 ml for an explicitly USDA US cup, 240 ml for the milk labels, and 15 ml for metric tablespoons. Canada's 250 ml cup is not compared as though it were a US cup. [Health Canada](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html).

| Slug / portion index | Our g | Second g | Assessment |
|---|---:|---:|---|
| lettuce [0] | 36 | 55.835 | flag: 36 g US cup is much lighter than the independently published approximately 55.83 g US-equivalent cup. Leaf packing and cut differ; a cup needs an explicit packing rule. [Health Canada looseleaf shredded lettuce, 250 ml = 59 g](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html) |
| mango [0] | 336 | 208 | flag: 336 g per fruit is 61.5% above the Canadian whole-fruit reference. Size/cultivar varies; this is a large-fruit convention, not a universal mango. A client counting one smaller mango can substantially miss the intended serving. [Health Canada mango, half fruit edible mass 104 g; whole calculated 208 g](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html) |
| bread-baladi [0] | 100 | 90 | flag: 100 g is a planning convention; the quoted subsidized loaf is 90 g. This is a real 11.1% mass overestimate for that loaf type, not evidence that every bakery loaf is 90 g. [Ministry spokesperson quoted by Al Wafd, 2026-10-25, subsidized baladi loaf 90 g](https://www.alwafd.news/5987906) |
| bread-baladi [1] | 50 | 45 | flag: The 50 g half-loaf inherits the same 100 g assumption; half of 90 g is 45 g. [Half of independently reported 90 g subsidized loaf](https://www.alwafd.news/5987906) |
| oats-dry [0] | 10 | 13.333 | flag: 10 g/spoon versus BDA approximate 13.33 g/spoon. Spoon packing/heaping is unspecified in both household conventions; the seed value needs a weighed calibration. [BDA porridge oats, 40 g = three tablespoons](https://www.bda.uk.com/resource/food-facts-portion-sizes.html) |
| bread-toast-white [0] | 27.3 | 35 | flag: 27.3 g is a thinner/smaller slice than the 35 g Canadian reference. Source weights may both be valid; a size-free slice default is not portable. [Health Canada commercial white bread, one slice 35 g](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html) |
| bread-toast-whole-wheat [0] | 32.1 | 35 | plausible: Different slice sizes; 32.1 g is close to this 35 g reference. [Health Canada commercial whole-wheat bread, one slice 35 g](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html) |
| pasta-cooked [0] | 140 | 140.06 | plausible: US-cup normalization gives about 140.06 g, supporting the 140 g default; 120 g elbows remain a different packing/shape. [Health Canada cooked macaroni, 250 ml = 148 g](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html) |
| rice-white-cooked [1] | 158 | 157.095 | plausible: US-cup normalization gives approximately 157.09 g, supporting 158 g. The separate default 80 g scoop remains assumed. [Health Canada cooked long-grain white rice, 125 ml = 83 g](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html) |
| rice-brown-cooked [1] | 202 | 194.949 | plausible: US-cup normalization gives approximately 194.95 g; 202 g is plausible. Default 80 g scoop remains assumed. [Health Canada cooked long-grain brown rice, 125 ml = 103 g](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html) |
| broccoli-cooked [0] | 156 | 155.202 | plausible: US-cup normalization gives 155.20 g, supporting 156 g. [Health Canada chopped boiled broccoli, 125 ml = 82 g](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html) |
| zucchini-cooked [0] | 180 | 179.807 | plausible: US-cup normalization gives 179.81 g, supporting 180 g. [Health Canada sliced boiled zucchini, 125 ml = 95 g](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html) |
| spinach-cooked [0] | 180 | 179.807 | plausible: US-cup normalization gives 179.81 g, supporting 180 g. [Health Canada boiled drained spinach, 125 ml = 95 g](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html) |
| tomato [0] | 123 | 123 | plausible: Supports the default mass; fruit sizes still vary. [Health Canada raw tomato, one edible fruit 123 g](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html) |
| banana [0] | 118 | 118 | plausible: Supports the default mass; Canadian/USDA lineage may overlap. [Health Canada banana, one edible fruit 118 g](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html) |
| egg-boiled [0] | 50 | 50 | plausible: Supports a large shelled egg, not every egg size. [Health Canada large hard-boiled egg, 50 g](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html) |
| milk-full-fat [0] | 247.52 | 247.68 | plausible: 240 ml normalized mass 247.68 g supports the stated density conversion. [Health Canada whole 3.3% milk, 250 ml = 258 g](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html) |
| milk-skimmed [0] | 248.53 | 248.64 | plausible: 240 ml normalized mass 248.64 g supports the stated density conversion. [Health Canada skim milk, 250 ml = 259 g](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html) |
| tahini [0] | 15 | 15 | plausible: 15 ml tablespoon = 15 g; agreement with the planning measure. [Health Canada tahini, 30 ml = 30 g](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html) |
| peanut-butter [0] | 16 | 16 | plausible: 15 ml tablespoon = 16 g; agreement for this formulation. [Health Canada smooth peanut butter with additions, 30 ml = 32 g](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html) |
| almonds [0] | 28 | 30 | plausible: 28 g small handful is consistent with a rough 30 g reference. [BDA unsalted nuts, one handful 30 g](https://www.bda.uk.com/resource/food-facts-portion-sizes.html) |
| walnuts [0] | 28 | 30 | plausible: 28 g small handful is consistent with a rough 30 g reference. [BDA unsalted nuts, one handful 30 g](https://www.bda.uk.com/resource/food-facts-portion-sizes.html) |

No independent same-measure mass obtained for: chicken-breast-raw, chicken-breast-grilled, chicken-breast-boiled, chicken-thigh-raw, chicken-thigh-grilled, chicken-thigh-boiled, beef-lean-raw, beef-lean-cooked, beef-ground-10-fat-raw, beef-ground-10-fat-cooked, beef-ground-20-fat-raw, beef-ground-20-fat-cooked, beef-liver-raw, liver-beef-cooked, tilapia-raw, tilapia-grilled, sea-bass-raw, sea-bass-grilled, mullet-raw, mackerel-raw, mackerel-grilled, tuna-canned-water, tuna-canned-oil, shrimp-cooked, fish-grilled, egg-raw, egg-white, milk-low-fat, yogurt-plain, yogurt-greek, labneh, domiati-cheese, feta-cheese, rumi-cheese, cottage-cheese, rice-white-raw, rice-brown-dry, pasta-dry, oats-cooked, potato-boiled, potato-baked, sweet-potato-baked, sweet-potato-boiled, fava-beans-dry, ful-medames, ful-with-oil, lentils-brown-dry, lentils-cooked, chickpeas-dry, chickpeas-cooked, cucumber, carrot, onion-raw, bell-pepper-green-raw, eggplant-raw, apple, orange, strawberries, watermelon, guava-raw, grapes-raw, cantaloupe-raw, pomegranate-raw, dates, dates-medjool, olive-oil, ghee, butter-salted, whey-protein. These are not counted as weight errors merely because they are unverified. For partially checked records, the other portions remain unverified too. In particular, chicken breast 120 g, thigh 110 g, tuna can 140 g, rice scoop 80 g, yogurt pot 150 g, small ful plate 150 g and whey 30 g scoop need an actual size/label/weighing protocol.

## Source and extraction integrity

All available primary energy/macronutrient values for the 89 selected USDA-backed records were re-extracted from cached CSVs and compared at 0.0002 tolerance: **no mismatches**. The remaining selected food, ful-with-oil, is publication-backed. Nutrient IDs checked against `nutrient.csv`: 1008 kcal; 1003 protein; 1004 fat; 1005 carbohydrate-by-difference; 1079 total fibre. Foundation 2048/2047 energy fallbacks were kept distinct. No confirmed decimal slip, wrong nutrient ID, kJ-as-kcal error, or unacknowledged raw-to-cooked numeric substitution was found in these 90. This does not establish that every food description is an appropriate match. Missing primary fibre and declared fallback provenance remain important limitations.

The Lebanese report was read in memory: PDF p.2 states CC BY 4.0; p.34/Table 13 repeats ful's 116 kcal/5.3 protein/14.2 carbs/4.2 fat. The cited Hoteit publication and that report share the underlying food series and do not provide an independent validation. Only these selected observations were retained. No OFF numbers were copied; no NNI scan, uncleared Bahrain table, branded-food database, or manufacturer table was used.

## Sources, attribution and read dates

Every source below was read/extracted on **2026-10-31**. Publication/release dates are separate from the access date. Primary-source URLs and entry codes are retained per selected comparison. USDA local paths are those specified in SPEC.md; CoFID workbooks were read into memory and only selected nutrient rows retained.

- U.S. Department of Agriculture, Agricultural Research Service, FoodData Central. SR Legacy release 2018-04 and Foundation release 2025-04-24, cached CSVs; public-domain/CC0 reference data. [Dataset downloads](https://fdc.nal.usda.gov/download-datasets/), [data documentation](https://fdc.nal.usda.gov/data-documentation/). Exact FDC URLs appear in the tables. These release names are not a claim that April 2025 is the latest release.
- Public Health England, McCance and Widdowson's CoFID 2021, Crown copyright, reused under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/). [Publication and downloads](https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid), [2021 workbook](https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx), [old-food workbook](https://assets.publishing.service.gov.uk/media/60538ba4e90e07527f645f88/CoFID_oldFoods.xlsx). Old 13-069 was not revalidated in 2015/2019/2021; used only as a flagged ful proxy.
- Health Canada, Nutrient Value of Some Common Foods 2008, based on CNF 2007b. [Official tables](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html). Household weights and three supplementary fibre checks only; Canada/USDA analytical lineage may overlap.
- Kaaki et al., Preference mapping of commercial Labneh (strained yogurt) products in the Lebanese market, Journal of Dairy Science 2012. [Table 2 PDF](https://www.journalofdairyscience.org/article/S0022030212000045/pdf). Only full-fat protein/fat/NFE means compared; derived energy identified as such. The 2024 label survey was examined but not used as independent assay evidence.
- Khider et al., Functional UF-low and full-fat Labneh supplemented with Oats (Avena sativa L.) powder and probiotic bacteria, 2022, CC BY 4.0. [Article](https://link.springer.com/article/10.1007/s43994-022-00003-8), [readable PDF](https://d-nb.info/1285721918/34). Only absence of dietary fibre in unsupplemented C2 was used. Table 1 and Table 2 appear to interchange low/full-fat protein values, so their protein and calculated energy were deliberately not used.
- Egyptian Journal of Food Science, 51(2), 257–266 (2023), Ras-cheese ingredient composition in Materials, p.258. [Publisher PDF](https://ejfs.journals.ekb.eg/article_328053_135b62aeabeb84b1c010124cf19c7d3a.pdf). Only the Ras ingredient protein/fat/carbohydrate compared; fibre unreported; energy calculated. This is not the spreadable processed-cheese outcome.
- Chemical, rheological, and sensorial properties of Baladi bread supplemented with buckwheat flour produced in Egypt, Scientific Reports (2024), CC BY 4.0. [Article/Table 5](https://www.nature.com/articles/s41598-023-48686-1). Only the wheat control: dry-basis measurements converted using moisture; crude and total dietary fibre kept distinct.
- Nutrients 2018, 10(9):1178, independently assayed WPC-80 composition, [Table 1](https://www.mdpi.com/2072-6643/10/9/1178). CC BY; 1712 kJ divided by 4.184 to kcal; fibre upper bound retained.
- Hoteit and collaborators, Lebanese University, Lebanon Food Composition Data (2021), [report](https://ul.edu.lb/files/ann/20211215-ULFPH-RePa-Version-Eng.pdf), DOI 10.17605/OSF.IO/KU563, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Used to check source ancestry and reject circular ful validation; not counted as a second independent recipe analysis.
- British Dietetic Association, [portion sizes](https://www.bda.uk.com/resource/food-facts-portion-sizes.html): only rough oat spoon and nut handful references compared; these do not prescribe a universal utensil packing density.
- Al Wafd, 25 October 2026, [Ministry of Supply spokesperson quotation](https://www.alwafd.news/5987906): 90 g subsidized loaf. A bounded loaf-type reference, not a claim about all Egyptian bread.

## Overall judgement for real clients

**Confidence in faithful extraction: high. Confidence in the dataset as a whole for unreviewed client meal prescriptions: low.** The audit supports many basic per-100-g values and found no confirmed extraction corruption. However, food identity, formulation, hydration and household mass remain material weaknesses. Agreement between two tables cannot rescue an incorrect local food label.

The numerical flag rate is not an estimated error rate: this is a purposive 90-food sample, and many flags reflect UK/US nutrient definitions, natural variation or deliberately disclosed weak comparators. Conversely, “ok” does not mean an assumed portion or Egyptian proxy was validated. The remaining files outside these 90 foods were not audited.

For a client-facing release, require a nutrition professional to resolve the five priority problems, identify the actual cheese/fish/whey type, standardize cooking yields for porridge/legumes/starches, and calibrate starter-plan units. Keep unresolved local proxies visibly unverified or out of automatic prescriptions. Do not mass-replace the seed with the comparison numbers.

Reproducibility: `selection.txt` lists 90 slugs; `matches.json` records deliberate source matches; `extract_checks.py` reads source CSVs/workbooks; `comparisons.json` preserves selected raw reference values and primary audit data; this builder records explicit calculations and outputs both QA artifacts. Input hashes were checked unchanged before writing the report. Supporting scripts write only within `out/q-scripts/`.
