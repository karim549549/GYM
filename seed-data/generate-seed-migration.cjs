const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const args = process.argv.slice(2);
const force = args.includes('--force');
const positional = args.filter((arg) => arg !== '--force');
const output = positional[0];
if (positional.length !== 1 || !output || !output.endsWith('.sql')) {
  throw new Error(
    'Usage: node seed-data/generate-seed-migration.cjs drizzle/00NN_nutrition_seed_vN.sql [--force]',
  );
}

// Run the validators themselves so generation cannot drift from their rules.
for (const validator of ['validate-foods.cjs', 'validate-recipes.cjs']) {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, validator)],
    {
      stdio: 'inherit',
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

const read = (name) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const bySlug = (a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
const foods = read('foods.json').sort(bySlug);
const recipes = read('recipes.json').sort(bySlug);
const foodBySlug = new Map(foods.map((food) => [food.slug, food]));
const pending = read('foods-pending-sourcing.json');
const starterSource = fs.readFileSync(
  path.join(
    __dirname,
    '../src/meal-plans/policies/starter-meal-plans.policy.ts',
  ),
  'utf8',
);
const starterSlugs = [
  ...new Set(
    [...starterSource.matchAll(/\bslug:\s*'([^']+)'/g)].map((m) => m[1]),
  ),
].sort();
if (!starterSlugs.length) throw new Error('No starter food slugs found');
for (const slug of starterSlugs) {
  if (!foodBySlug.has(slug)) throw new Error(`Missing starter food: ${slug}`);
}
for (const item of pending) {
  if (foodBySlug.has(item.slug))
    throw new Error(`Pending food is in the seed: ${item.slug}`);
}

// These checks protect SQL identity matching and reject fields validators allow to be unknown.
for (const item of [...foods, ...recipes]) {
  if (item.confidence === 'none')
    throw new Error(`Cannot seed unknown nutrition: ${item.slug}`);
  const names = item.portions.map((portion) => portion.name_ar);
  if (new Set(names).size !== names.length)
    throw new Error(`Duplicate portion name: ${item.slug}`);
  for (const portion of item.portions) {
    if (typeof portion.is_default !== 'boolean')
      throw new Error(`Non-boolean default: ${item.slug}`);
  }
  for (const key of [
    'aliases_ar',
    'aliases_en',
    'search_hints',
    'review_flags',
  ]) {
    if (
      key === 'search_hints' &&
      item[key] === undefined &&
      recipes.includes(item)
    )
      continue;
    if (
      !Array.isArray(item[key]) ||
      item[key].some((value) => typeof value !== 'string' || !value.trim())
    ) {
      throw new Error(`Invalid ${key}: ${item.slug}`);
    }
  }
}

const macros = [
  'calories_kcal_per_100g',
  'protein_g_per_100g',
  'carbs_g_per_100g',
  'fat_g_per_100g',
  'fiber_g_per_100g',
];
const nutrientCodes = {
  sugars_g: 'sugars',
  saturated_fat_g: 'saturated_fat',
  sodium_mg: 'sodium',
  calcium_mg: 'calcium',
  iron_mg: 'iron',
  potassium_mg: 'potassium',
  vitamin_c_mg: 'vitamin_c',
};
const statements = [];
const emit = (sql) => statements.push(`${sql};`);
const tables = [
  'foods',
  'food_portions',
  'food_nutrients',
  'food_aliases',
  'recipes',
  'recipe_ingredients',
  'recipe_steps',
  'recipe_portions',
  'recipe_aliases',
];
for (const table of tables)
  emit(`ALTER TABLE ${table} NO FORCE ROW LEVEL SECURITY`);

const aliasesFor = (item) =>
  [
    ['aliases_ar', 'alias_ar'],
    ['aliases_en', 'alias_en'],
    ['search_hints', 'search_hint'],
  ].flatMap(([key, kind]) =>
    [...new Set((item[key] || []).map((value) => value.trim()))].map(
      (alias) => ({ kind, alias }),
    ),
  );
const typeFor = (column) => {
  if (column === 'workspace_id') return 'uuid';
  if (['review_flags', 'meal_tags'].includes(column)) return 'text[]';
  if (['is_verified', 'is_active'].includes(column)) return 'boolean';
  if (['usda_fdc_id', 'prep_minutes', 'cook_minutes'].includes(column))
    return 'integer';
  if (macros.includes(column) || column === 'finished_weight_g')
    return 'numeric';
  return 'text';
};
const literal = (tag, data) => {
  const json = `[\n${data.map((row) => `  ${JSON.stringify(row)}`).join(',\n')}\n]`;
  const delimiter = `$${tag}$`;
  if (json.includes(delimiter))
    throw new Error(`Dollar quote collision: ${delimiter}`);
  if (json.includes('\\u0000')) throw new Error('Invalid SQL text: NUL');
  return `${delimiter}${json}${delimiter}::jsonb`;
};
const upsert = (table, columns, rows) => {
  const items = table === 'foods' ? foods : recipes;
  const children =
    table === 'foods'
      ? ['portions', 'aliases', 'nutrients']
      : ['portions', 'aliases', 'ingredients', 'steps'];
  const payload = rows.map((row, index) => {
    const item = items[index];
    return {
      ...Object.fromEntries(
        columns.map((column, i) => [column, row[i] ?? null]),
      ),
      portions: item.portions.map(({ name_ar, weight_g, is_default }) => ({
        name_ar,
        weight_g,
        is_default,
      })),
      aliases: aliasesFor(item),
      ...(table === 'foods'
        ? {
            nutrients: Object.entries(nutrientCodes)
              .filter(
                ([key]) =>
                  item.nutrients[key] !== null &&
                  item.nutrients[key] !== undefined,
              )
              .map(([key, code]) => ({
                code,
                amount_per_100g: item.nutrients[key],
              })),
          }
        : {
            ingredients: item.ingredients.map(
              ({ food_slug, weight_g, note_ar }) => ({
                food_slug,
                weight_g,
                note_ar: note_ar ?? null,
              }),
            ),
            steps: item.steps_ar,
          }),
    };
  });
  // Transaction-local staging parses each payload once; Drizzle runs the migration in one transaction.
  emit(`CREATE TEMP TABLE nutrition_seed_${table} ON COMMIT DROP AS
SELECT * FROM jsonb_to_recordset(${literal(`seed_${table}`, payload)})
AS d(${[...columns.map((column) => `${column} ${typeFor(column)}`), ...children.map((column) => `${column} jsonb`)].join(', ')})`);
  emit(`INSERT INTO ${table} (${columns.join(', ')})
SELECT ${columns.join(', ')} FROM pg_temp.nutrition_seed_${table} WHERE true
ON CONFLICT (slug) WHERE workspace_id IS NULL DO UPDATE SET
${columns
  .filter((column) => !['slug', 'workspace_id'].includes(column))
  .map((column) => `  ${column} = EXCLUDED.${column}`)
  .join(',\n')}`);
};
upsert(
  'foods',
  [
    'workspace_id',
    'slug',
    'name_ar',
    'name_en',
    'category',
    'state',
    ...macros,
    'origin',
    'origin_note',
    'confidence',
    'review_flags',
    'usda_fdc_id',
    'is_verified',
    'entry_basis',
    'is_active',
  ],
  foods.map((food) => [
    null,
    food.slug,
    food.name_ar,
    food.name_en,
    food.category,
    food.state,
    ...macros.map((key) => food[key]),
    'seed',
    food.origin_note,
    food.confidence,
    food.review_flags,
    food.usda_fdc_id,
    false,
    'per_100g',
    true,
  ]),
);
emit(`UPDATE foods f SET is_active = false
WHERE f.workspace_id IS NULL AND f.origin = 'estimate'
  AND NOT EXISTS (SELECT 1 FROM pg_temp.nutrition_seed_foods d WHERE d.slug = f.slug)`);
upsert(
  'recipes',
  [
    'workspace_id',
    'slug',
    'name_ar',
    'name_en',
    'description_ar',
    ...macros,
    'origin',
    'origin_note',
    'confidence',
    'review_flags',
    'meal_tags',
    'finished_weight_g',
    'prep_minutes',
    'cook_minutes',
    'youtube_video_id',
    'is_active',
  ],
  recipes.map((recipe) => {
    const per100 = macros.map((key) => {
      let total = 0;
      for (const ingredient of recipe.ingredients)
        total +=
          (ingredient.weight_g / 100) *
          foodBySlug.get(ingredient.food_slug)[key];
      return Math.round((total / recipe.finished_weight_g) * 100 * 100) / 100;
    });
    return [
      null,
      recipe.slug,
      recipe.name_ar,
      recipe.name_en,
      recipe.description_ar,
      ...per100,
      'seed',
      `${recipe.origin_note}\nYield: ${recipe.yield_note}`,
      recipe.confidence,
      recipe.review_flags,
      recipe.meal_tags,
      recipe.finished_weight_g,
      recipe.prep_minutes,
      recipe.cook_minutes,
      recipe.youtube_video_id,
      true,
    ];
  }),
);

const parents = [
  ['foods', 'food_id', 'food_portions', 'food_aliases'],
  ['recipes', 'recipe_id', 'recipe_portions', 'recipe_aliases'],
];
for (const [parent, key, portions, aliases] of parents) {
  const source = `pg_temp.nutrition_seed_${parent}`;
  const desired = `SELECT p.id AS parent_id, v.name_ar, v.weight_g, v.is_default, a.ordinality::integer AS sort_order
  FROM ${source} d
  JOIN ${parent} p ON p.slug = d.slug AND p.workspace_id IS NULL
  CROSS JOIN LATERAL jsonb_array_elements(d.portions) WITH ORDINALITY AS a(value, ordinality)
  CROSS JOIN LATERAL jsonb_to_record(a.value) AS v(name_ar text, weight_g numeric, is_default boolean)`;
  emit(`UPDATE ${portions} c SET is_default = false
FROM ${parent} p JOIN ${source} d ON d.slug = p.slug
WHERE p.workspace_id IS NULL AND c.workspace_id IS NULL AND c.${key} = p.id`);
  // The update and insert target disjoint rows in the same snapshot; matching portions retain their ids.
  emit(`WITH desired AS (${desired}), updated AS (
  UPDATE ${portions} c SET weight_g = d.weight_g, is_default = d.is_default, sort_order = d.sort_order
  FROM desired d WHERE c.workspace_id IS NULL AND c.${key} = d.parent_id AND c.name_ar = d.name_ar
  RETURNING c.id
)
INSERT INTO ${portions} (workspace_id, ${key}, name_ar, weight_g, is_default, sort_order)
SELECT NULL, d.parent_id, d.name_ar, d.weight_g, d.is_default, d.sort_order FROM desired d
WHERE NOT EXISTS (SELECT 1 FROM ${portions} c WHERE c.workspace_id IS NULL AND c.${key} = d.parent_id AND c.name_ar = d.name_ar)`);
  emit(`DELETE FROM ${portions} c USING ${parent} p, ${source} d
WHERE p.workspace_id IS NULL AND c.workspace_id IS NULL AND c.${key} = p.id AND p.slug = d.slug
  AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(d.portions) AS v(name_ar text) WHERE v.name_ar = c.name_ar)`);
  emit(`DELETE FROM ${aliases} c USING ${parent} p, ${source} d
WHERE p.workspace_id IS NULL AND c.workspace_id IS NULL AND c.${key} = p.id AND p.slug = d.slug`);
  // Preserve first-in-array conflict winners after the BEFORE INSERT search-alias trigger normalizes them.
  emit(`INSERT INTO ${aliases} (workspace_id, ${key}, kind, alias)
SELECT NULL, p.id, v.kind, v.alias FROM ${source} d
JOIN ${parent} p ON p.slug = d.slug AND p.workspace_id IS NULL
CROSS JOIN LATERAL jsonb_array_elements(d.aliases) WITH ORDINALITY AS a(value, ordinality)
CROSS JOIN LATERAL jsonb_to_record(a.value) AS v(kind text, alias text)
ORDER BY d.slug, a.ordinality
ON CONFLICT (${key}, kind, search_alias) DO NOTHING`);
}
const replaceChildren = (table) =>
  emit(`DELETE FROM ${table} c USING recipes p, pg_temp.nutrition_seed_recipes d
WHERE p.workspace_id IS NULL AND c.workspace_id IS NULL AND c.recipe_id = p.id AND p.slug = d.slug`);
emit(`DELETE FROM food_nutrients c USING foods p, pg_temp.nutrition_seed_foods d
WHERE p.workspace_id IS NULL AND c.workspace_id IS NULL AND c.food_id = p.id AND p.slug = d.slug`);
emit(`INSERT INTO food_nutrients (workspace_id, food_id, nutrient_id, amount_per_100g)
SELECT NULL, p.id, n.id, v.amount_per_100g FROM pg_temp.nutrition_seed_foods d
JOIN foods p ON p.slug = d.slug AND p.workspace_id IS NULL
CROSS JOIN LATERAL jsonb_to_recordset(d.nutrients) AS v(code text, amount_per_100g numeric)
JOIN nutrients n ON n.code = v.code`);
replaceChildren('recipe_ingredients');
emit(`INSERT INTO recipe_ingredients (workspace_id, recipe_id, sort_order, food_id, weight_g, note_ar)
SELECT NULL, p.id, a.ordinality::integer, f.id, v.weight_g, v.note_ar
FROM pg_temp.nutrition_seed_recipes d
JOIN recipes p ON p.slug = d.slug AND p.workspace_id IS NULL
CROSS JOIN LATERAL jsonb_array_elements(d.ingredients) WITH ORDINALITY AS a(value, ordinality)
CROSS JOIN LATERAL jsonb_to_record(a.value) AS v(food_slug text, weight_g numeric, note_ar text)
INNER JOIN foods f ON f.slug = v.food_slug AND f.workspace_id IS NULL`);
replaceChildren('recipe_steps');
emit(`INSERT INTO recipe_steps (workspace_id, recipe_id, sort_order, instruction)
SELECT NULL, p.id, a.ordinality::integer, a.instruction
FROM pg_temp.nutrition_seed_recipes d
JOIN recipes p ON p.slug = d.slug AND p.workspace_id IS NULL
CROSS JOIN LATERAL jsonb_array_elements_text(d.steps) WITH ORDINALITY AS a(instruction, ordinality)`);
emit(`DO $seed_verify$
BEGIN
  IF (SELECT count(*) FROM foods WHERE workspace_id IS NULL AND origin = 'seed' AND is_active) <> ${foods.length} THEN
    RAISE EXCEPTION 'Nutrition seed: active food count mismatch';
  END IF;
  IF EXISTS (
    SELECT d.slug FROM pg_temp.nutrition_seed_foods d
    LEFT JOIN foods f ON f.slug = d.slug AND f.workspace_id IS NULL
    LEFT JOIN food_nutrients n ON n.food_id = f.id AND n.workspace_id IS NULL
    GROUP BY d.slug, d.nutrients HAVING count(n.nutrient_id) <> jsonb_array_length(d.nutrients)
  ) THEN RAISE EXCEPTION 'Nutrition seed: nutrient count mismatch (unresolved nutrient code or missing food)'; END IF;
  IF EXISTS (
    SELECT d.slug FROM pg_temp.nutrition_seed_recipes d
    LEFT JOIN recipes r ON r.slug = d.slug AND r.workspace_id IS NULL
    LEFT JOIN recipe_ingredients i ON i.recipe_id = r.id AND i.workspace_id IS NULL
    GROUP BY d.slug, d.ingredients HAVING count(i.id) <> jsonb_array_length(d.ingredients)
  ) THEN RAISE EXCEPTION 'Nutrition seed: ingredient count mismatch (unresolved food slug or missing recipe)'; END IF;
  IF (SELECT count(*) FROM foods f JOIN jsonb_array_elements_text(${literal('seed_starters', starterSlugs)}) AS d(slug) ON d.slug = f.slug
      WHERE f.workspace_id IS NULL AND f.is_active) <> ${starterSlugs.length} THEN
    RAISE EXCEPTION 'Nutrition seed: missing active starter food';
  END IF;
${parents
  .map(
    ([parent, key, child]) => `  IF EXISTS (
    SELECT p.id FROM ${parent} p JOIN pg_temp.nutrition_seed_${parent} d ON d.slug = p.slug
    LEFT JOIN ${child} c ON c.${key} = p.id AND c.workspace_id IS NULL AND c.is_default
    WHERE p.workspace_id IS NULL GROUP BY p.id HAVING count(c.id) <> 1
  ) THEN RAISE EXCEPTION 'Nutrition seed: expected one default portion per ${parent}'; END IF;`,
  )
  .join('\n')}
END;
$seed_verify$`);
// The deferred foreign keys (migration 0060) queue a check for every row loaded above, and Postgres refuses
// to alter a table while checks are pending: run them now (this also validates every loaded row).
emit('SET CONSTRAINTS ALL IMMEDIATE');
for (const table of tables)
  emit(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
const sql = `-- Generated from reviewed seed-data JSON. Do not edit; generate a new migration for corrections.\n${statements.join('\n--> statement-breakpoint\n')}\n`;
if (fs.existsSync(output)) {
  const previous = fs.readFileSync(output, 'utf8');
  if (
    previous.trim() &&
    !/^-- Custom SQL migration file, put your code below! --\s*$/.test(
      previous,
    ) &&
    previous !== sql &&
    !force
  ) {
    throw new Error(
      'Refusing to overwrite a different migration; create the next custom migration. Use --force ONLY if the target migration has never been applied anywhere; the generator cannot check this.',
    );
  }
}
fs.writeFileSync(output, sql, 'utf8');
console.log(
  `Wrote ${output}: ${Buffer.byteLength(sql)} bytes, ${statements.length} statements, ${foods.length} foods, ${recipes.length} recipes`,
);
