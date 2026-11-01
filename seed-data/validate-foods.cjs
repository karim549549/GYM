// Validates food seed files against SPEC.md. Usage: node validate-foods.cjs <file.json | directory>
const fs = require('node:fs');
const path = require('node:path');

const CATEGORIES = new Set([
  'protein',
  'carb',
  'fat',
  'vegetable',
  'fruit',
  'dairy',
  'drink',
  'composite',
  'supplement',
]);
const STATES = new Set(['raw', 'cooked', 'ready_to_eat', 'dry']);
const CONFIDENCE = new Set(['high', 'medium', 'low', 'none']);
const NUTRIENT_KEYS = [
  'sugars_g',
  'saturated_fat_g',
  'sodium_mg',
  'calcium_mg',
  'iron_mg',
  'potassium_mg',
  'vitamin_c_mg',
];
const MACROS = [
  'calories_kcal_per_100g',
  'protein_g_per_100g',
  'carbs_g_per_100g',
  'fat_g_per_100g',
  'fiber_g_per_100g',
];

const target = process.argv[2] || path.join(__dirname, 'foods.json');
if (!target) {
  console.error('usage: node validate-foods.cjs <file.json | directory>');
  process.exit(2);
}
const files = fs.statSync(target).isDirectory()
  ? fs
      .readdirSync(target)
      .filter((f) => /^foods-.*\.json$/.test(f))
      .map((f) => path.join(target, f))
  : [target];

const errors = [];
const warnings = [];
const seen = new Map();
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

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
  items.forEach((f, i) => {
    const at = `${path.basename(file)}[${i}] ${f && f.slug}`;
    const err = (m) => errors.push(`${at}: ${m}`);
    const warn = (m) => warnings.push(`${at}: ${m}`);
    if (!f || typeof f !== 'object') return err('not an object');

    if (typeof f.slug !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.slug))
      err('slug must be lowercase kebab-case');
    else if (seen.has(f.slug))
      err(`duplicate slug (also in ${seen.get(f.slug)})`);
    else seen.set(f.slug, path.basename(file));

    for (const k of ['name_ar', 'name_en'])
      if (typeof f[k] !== 'string' || !f[k].trim()) err(`${k} required`);
    if (typeof f.name_ar === 'string' && /[ً-ْ]/.test(f.name_ar))
      warn('name_ar has diacritics');
    if (typeof f.name_ar === 'string' && !/[؀-ۿ]/.test(f.name_ar))
      err('name_ar has no Arabic letters');
    if (!Array.isArray(f.aliases_ar) || !Array.isArray(f.aliases_en))
      err('aliases_ar and aliases_en must be arrays');
    if (!CATEGORIES.has(f.category))
      err(`category must be one of ${[...CATEGORIES].join(', ')}`);
    if (!STATES.has(f.state))
      err(`state must be one of ${[...STATES].join(', ')}`);
    if (!CONFIDENCE.has(f.confidence))
      err('confidence must be high, medium, low or none');
    if (f.origin !== 'seed') err('origin must be "seed"');
    if (typeof f.origin_note !== 'string' || !f.origin_note.trim())
      err('origin_note required');
    if (!Array.isArray(f.review_flags)) err('review_flags must be an array');
    else if (f.confidence !== 'high' && f.review_flags.length === 0)
      err('confidence below high needs at least one review_flag');

    const noSource = f.confidence === 'none';
    if (noSource) {
      if (!f.review_flags || !f.review_flags.includes('no_source'))
        err('confidence none needs the no_source flag');
      for (const k of MACROS)
        if (f[k] !== null && f[k] !== undefined)
          err(`${k} must be null when confidence is none`);
    } else {
      for (const k of MACROS)
        if (!isNum(f[k]) || f[k] < 0) err(`${k} must be a number >= 0`);
      if (MACROS.every((k) => isNum(f[k]))) {
        const worked =
          4 * f.protein_g_per_100g +
          4 * f.carbs_g_per_100g +
          9 * f.fat_g_per_100g;
        const slack = Math.max(20, 0.25 * worked);
        if (Math.abs(f.calories_kcal_per_100g - worked) > slack)
          err(
            `calories ${f.calories_kcal_per_100g} vs ${worked.toFixed(1)} from macros (allowed +-${slack.toFixed(1)})`,
          );
        if (f.protein_g_per_100g + f.carbs_g_per_100g + f.fat_g_per_100g > 100)
          err('protein + carbs + fat > 100 g');
        if (f.fiber_g_per_100g > f.carbs_g_per_100g) err('fiber > carbs');
        if (f.calories_kcal_per_100g > 900) err('calories above 900 per 100 g');
      }
    }

    if (!f.nutrients || typeof f.nutrients !== 'object')
      err('nutrients object required (values may be null)');
    else
      for (const [k, v] of Object.entries(f.nutrients)) {
        if (!NUTRIENT_KEYS.includes(k)) err(`unknown nutrient key ${k}`);
        else if (v !== null && (!isNum(v) || v < 0))
          err(`nutrient ${k} must be null or a number >= 0`);
      }

    if (
      !Array.isArray(f.portions) ||
      f.portions.length < 1 ||
      f.portions.length > 5
    )
      err('portions: 1 to 5 required');
    else {
      const defaults = f.portions.filter((p) => p.is_default).length;
      if (defaults !== 1) err('exactly one portion must have is_default true');
      f.portions.forEach((p, j) => {
        if (typeof p.name_ar !== 'string' || !/[؀-ۿ]/.test(p.name_ar))
          err(`portions[${j}].name_ar must be Arabic`);
        if (!isNum(p.weight_g) || p.weight_g <= 0)
          err(`portions[${j}].weight_g must be > 0`);
        if (typeof p.basis !== 'string' || !p.basis.trim())
          err(`portions[${j}].basis required`);
      });
    }
    if (
      f.usda_fdc_id !== undefined &&
      f.usda_fdc_id !== null &&
      !Number.isInteger(f.usda_fdc_id)
    )
      err('usda_fdc_id must be an integer or null');
  });
}

for (const w of warnings) console.log(`warning: ${w}`);
if (errors.length) {
  for (const e of errors) console.log(`error: ${e}`);
  console.log(
    `FAILED: ${errors.length} error(s), ${warnings.length} warning(s), ${seen.size} foods`,
  );
  process.exit(1);
}
console.log(`OK: ${seen.size} foods, ${warnings.length} warning(s)`);
