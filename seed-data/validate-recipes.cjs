// Validates recipe files against RECIPES-SPEC.md and prints the calculated nutrition.
// Usage: node validate-recipes.cjs <file.json | directory>
const fs = require('node:fs');
const path = require('node:path');

const target = process.argv[2] || path.join(__dirname, 'recipes.json');
if (!target) {
  console.error('usage: node validate-recipes.cjs <file.json | directory>');
  process.exit(2);
}

const foods = new Map();
for (const food of JSON.parse(
  fs.readFileSync(path.join(__dirname, 'foods.json'), 'utf8'),
))
  foods.set(food.slug, food);
const files = fs.statSync(target).isDirectory()
  ? fs
      .readdirSync(target)
      .filter((f) => /^recipes-.*\.json$/.test(f))
      .map((f) => path.join(target, f))
  : [target];

const TAGS = new Set([
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'pre_workout',
  'post_workout',
]);
const CONF = new Set(['high', 'medium', 'low']);
const errors = [];
const warnings = [];
const slugs = new Map();
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const r1 = (n) => Math.round(n * 10) / 10;

for (const file of files) {
  let items;
  try {
    items = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    errors.push(`${file}: not valid JSON (${e.message})`);
    continue;
  }
  if (!Array.isArray(items)) {
    errors.push(`${file}: top level must be an array`);
    continue;
  }
  items.forEach((r, i) => {
    const at = `${path.basename(file)}[${i}] ${r && r.slug}`;
    const err = (m) => errors.push(`${at}: ${m}`);
    const warn = (m) => warnings.push(`${at}: ${m}`);
    if (!r || typeof r !== 'object') return err('not an object');

    if (typeof r.slug !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.slug))
      err('slug must be lowercase kebab-case');
    else if (slugs.has(r.slug))
      err(`duplicate recipe slug (also in ${slugs.get(r.slug)})`);
    else if (foods.has(r.slug)) err('slug is also a food slug');
    else slugs.set(r.slug, path.basename(file));

    for (const k of ['name_ar', 'name_en', 'description_ar'])
      if (typeof r[k] !== 'string' || !r[k].trim()) err(`${k} required`);
    if (typeof r.name_ar === 'string' && !/[؀-ۿ]/.test(r.name_ar))
      err('name_ar has no Arabic letters');
    if (!Array.isArray(r.aliases_ar) || !Array.isArray(r.aliases_en))
      err('aliases_ar and aliases_en must be arrays');
    if (!Array.isArray(r.meal_tags) || r.meal_tags.some((t) => !TAGS.has(t)))
      err('meal_tags must be an array of known tags');
    if (!CONF.has(r.confidence)) err('confidence must be high, medium or low');
    if (r.origin !== 'seed') err('origin must be "seed"');
    if (typeof r.origin_note !== 'string' || !r.origin_note.trim())
      err('origin_note required');
    if (typeof r.yield_note !== 'string' || !r.yield_note.trim())
      err('yield_note required');
    if (!Array.isArray(r.review_flags)) err('review_flags must be an array');
    else if (r.confidence !== 'high' && r.review_flags.length === 0)
      err('confidence below high needs a review_flag');
    for (const k of ['prep_minutes', 'cook_minutes'])
      if (r[k] !== null && !(Number.isInteger(r[k]) && r[k] >= 0))
        err(`${k} must be a non-negative integer or null`);
    if (
      r.youtube_video_id !== null &&
      !/^[A-Za-z0-9_-]{11}$/.test(r.youtube_video_id || '')
    )
      err('youtube_video_id must be null or 11 characters');
    if (r.youtube_video_id && !/youtube/i.test(r.origin_note))
      err('a youtube_video_id needs its title and channel in origin_note');

    if (
      !Array.isArray(r.steps_ar) ||
      r.steps_ar.length < 3 ||
      r.steps_ar.length > 12
    )
      err('steps_ar: 3 to 12 steps required');
    else if (r.steps_ar.some((s) => typeof s !== 'string' || !/[؀-ۿ]/.test(s)))
      err('every step must be Arabic text');

    if (!isNum(r.finished_weight_g) || r.finished_weight_g <= 0)
      err('finished_weight_g must be > 0');

    let sum = 0;
    const total = { kcal: 0, p: 0, c: 0, f: 0, fiber: 0 };
    if (
      !Array.isArray(r.ingredients) ||
      r.ingredients.length < 3 ||
      r.ingredients.length > 25
    )
      err('ingredients: 3 to 25 required');
    else
      r.ingredients.forEach((ing, j) => {
        const food = foods.get(ing.food_slug);
        if (!food)
          return err(`ingredients[${j}]: unknown food_slug ${ing.food_slug}`);
        if (!isNum(ing.weight_g) || ing.weight_g <= 0)
          return err(`ingredients[${j}]: weight_g must be > 0`);
        if (food.confidence === 'none' || food.calories_kcal_per_100g === null)
          return err(`ingredients[${j}]: ${ing.food_slug} has no nutrition`);
        sum += ing.weight_g;
        const k = ing.weight_g / 100;
        total.kcal += k * food.calories_kcal_per_100g;
        total.p += k * food.protein_g_per_100g;
        total.c += k * food.carbs_g_per_100g;
        total.f += k * food.fat_g_per_100g;
        total.fiber += k * food.fiber_g_per_100g;
      });

    if (isNum(r.finished_weight_g) && sum > 0) {
      const ratio = r.finished_weight_g / sum;
      if (ratio < 0.25 || ratio > 5)
        err(
          `finished weight is ${ratio.toFixed(2)}x the ingredients (allowed 0.25x to 5x)`,
        );
      else if (ratio < 0.4 || ratio > 3.5)
        warn(`finished weight is ${ratio.toFixed(2)}x the ingredients`);
      const per100 = {
        kcal: (total.kcal / r.finished_weight_g) * 100,
        p: (total.p / r.finished_weight_g) * 100,
        c: (total.c / r.finished_weight_g) * 100,
        f: (total.f / r.finished_weight_g) * 100,
        fiber: (total.fiber / r.finished_weight_g) * 100,
      };
      const worked = 4 * per100.p + 4 * per100.c + 9 * per100.f;
      if (Math.abs(per100.kcal - worked) > Math.max(20, 0.25 * worked))
        err(
          `calculated calories ${r1(per100.kcal)} vs ${r1(worked)} from macros`,
        );
      if (per100.kcal < 20 || per100.kcal > 600)
        err(
          `calculated ${r1(per100.kcal)} kcal per 100 g is implausible for a dish`,
        );
      if (per100.p + per100.c + per100.f > 100)
        err('calculated macros exceed 100 g per 100 g');
      if (per100.fiber > per100.c) err('calculated fibre exceeds carbs');
      if (Array.isArray(r.portions)) {
        const def = r.portions.find((p) => p.is_default);
        console.log(
          `${r.slug.padEnd(34)} ${String(r1(per100.kcal)).padStart(6)} kcal  P${r1(per100.p)} C${r1(per100.c)} F${r1(per100.f)} /100g` +
            (def
              ? `  | ${def.name_ar} ${def.weight_g} g = ${Math.round((per100.kcal * def.weight_g) / 100)} kcal, P${r1((per100.p * def.weight_g) / 100)}`
              : ''),
        );
      }
    }

    if (
      !Array.isArray(r.portions) ||
      r.portions.length < 1 ||
      r.portions.length > 4
    )
      err('portions: 1 to 4 required');
    else {
      if (r.portions.filter((p) => p.is_default).length !== 1)
        err('exactly one portion must have is_default true');
      r.portions.forEach((p, j) => {
        if (typeof p.name_ar !== 'string' || !/[؀-ۿ]/.test(p.name_ar))
          err(`portions[${j}].name_ar must be Arabic`);
        if (!isNum(p.weight_g) || p.weight_g <= 0)
          err(`portions[${j}].weight_g must be > 0`);
        if (typeof p.basis !== 'string' || !p.basis.trim())
          err(`portions[${j}].basis required`);
      });
    }
  });
}

for (const w of warnings) console.log(`warning: ${w}`);
if (errors.length) {
  for (const e of errors) console.log(`error: ${e}`);
  console.log(
    `FAILED: ${errors.length} error(s), ${warnings.length} warning(s), ${slugs.size} recipes`,
  );
  process.exit(1);
}
console.log(`OK: ${slugs.size} recipes, ${warnings.length} warning(s)`);
