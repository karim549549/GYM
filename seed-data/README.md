# Nutrition seed

- `foods.json`: 437 reviewed generic foods, source notes, macros per 100 g,
  optional nutrients, aliases, search hints and portions with weight provenance.
- `recipes.json`: 51 reviewed recipes. Ingredient weights and finished yield
  determine nutrition; there are no independently entered recipe macro values.
- `foods-pending-sourcing.json`: 16 foods without honest nutrition numbers. They
  are excluded from the seed.
- `validate-foods.cjs` and `validate-recipes.cjs`: standalone Node validators;
  default to the JSON files beside them, including ingredient resolution.
- `generate-seed-migration.cjs`: dependency-free, deterministic SQL generator.
- `docs/foods-spec.md` and `docs/recipes-spec.md`: field definitions and review
  rules (their original collection-folder paths are historical).
- `docs/research-sources.md`: source research and licence evidence. Other files
  in `docs/` retain collection and review notes.

Numbers come from USDA FoodData Central (Foundation Foods and SR Legacy), and
selected regional sources identified in each food's `origin_note`. USDA FDC is
CC0. The Lebanese University 2021 report is CC BY 4.0 and requires attribution.
Show this in the product's nutrition data credits, with clickable source/licence
links, and identify the applicable source on food details:

> Includes data adapted from Lebanese University, Maha Hoteit and Edwina Zoghbi,
> _Lebanon Food
> Composition Data: Traditional Dishes, Arabic Sweets and Market Foods_ (2021),
> https://doi.org/10.17605/OSF.IO/KU563, licensed under CC BY 4.0
> (https://creativecommons.org/licenses/by/4.0/). Arabic names, food mappings,
> portions and presentation have been adapted for this product; regional proxy
> mappings are identified in the source notes. USDA FoodData Central data is CC0.

Preserve source-specific author credits in `origin_note` when displaying regional
data; the credits above do not replace them. Recipe quantities and yields are
documented adaptations or assumptions; recipe nutrition is calculated from foods.
Unknown nutrients remain null. Nothing is marked nutritionally verified.

To correct a number, edit the reviewed JSON and its source note, then from the
repository root run:

```sh
npm run seed:validate
npx drizzle-kit generate --custom --name nutrition_seed_v2
npm run seed:generate -- drizzle/00NN_nutrition_seed_v2.sql
```

Use the actual next numbered filename created by Drizzle; increment the version
for each correction. Generate requires `DIRECT_URL` in its command environment;
an offline dummy URL is sufficient because generation never connects. The custom
migration creates the journal entry and snapshot; the generator fills its empty
SQL file. Never edit an applied migration. The generator refuses a different
nonempty file, but accepts an identical rerun. Review SQL before deployment.

For a migration that has **never been applied anywhere**, regeneration may use
`npm run seed:generate -- drizzle/00NN_nutrition_seed_vN.sql --force`.
`--force` bypasses the differing-file safeguard; the generator cannot check
whether a migration has been applied. Never use it for an applied migration.

The generator loads one dollar-quoted JSONB payload per parent table into
transaction-local temporary tables (`ON COMMIT DROP`), then writes parents and
children with set-based joins. Run the migration in one transaction, as Drizzle
does. Portions match by parent and Arabic name and keep their ids; other children
are replaced. Array ordinality defines portion, ingredient and step order, and
alias order preserves the first winner after search normalization. Recipe macros
are calculated and rounded in Node before serialization. Payload tags are checked
for collisions. The final verification block refuses missing ingredient matches
and incorrect default portions. Unit tests compare payloads to the reviewed JSON.

Still owed: a native Egyptian cook must review Arabic names, instructions and
household portions; a nutritionist must review nutrition numbers, proxy mappings
and recipe yields. The collected data is reviewed for consistency, not a claim
that those professional reviews have happened.
