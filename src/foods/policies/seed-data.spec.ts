import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FoodMacrosPolicy } from './food-macros.policy';
import { StarterMealPlansPolicy } from '../../meal-plans/policies/starter-meal-plans.policy';

interface SeedPortion {
  name_ar: string;
  weight_g: number;
  is_default: boolean;
}
interface SeedFood extends Record<string, unknown> {
  slug: string;
  name_ar: string;
  name_en: string;
  calories_kcal_per_100g: number;
  protein_g_per_100g: number;
  carbs_g_per_100g: number;
  fat_g_per_100g: number;
  fiber_g_per_100g: number;
  portions: SeedPortion[];
}
interface SeedRecipe extends Record<string, unknown> {
  slug: string;
  finished_weight_g: number;
  ingredients: {
    food_slug: string;
    weight_g: number;
    note_ar?: string | null;
  }[];
  portions: SeedPortion[];
}

const foods = JSON.parse(
  readFileSync(resolve('seed-data/foods.json'), 'utf8'),
) as SeedFood[];
const recipes = JSON.parse(
  readFileSync(resolve('seed-data/recipes.json'), 'utf8'),
) as SeedRecipe[];
const pending = JSON.parse(
  readFileSync(resolve('seed-data/foods-pending-sourcing.json'), 'utf8'),
) as SeedFood[];
const bySlug = new Map(foods.map((food) => [food.slug, food]));
const macrosPolicy = new FoodMacrosPolicy();
const migration = readFileSync(
  resolve('drizzle/0062_nutrition_seed_v1.sql'),
  'utf8',
);
const payload = (table: string): Record<string, unknown>[] => {
  const parts = migration.split(`$seed_${table}$`);
  expect(parts).toHaveLength(3);
  return JSON.parse(parts[1]) as Record<string, unknown>[];
};
const macroKeys = [
  'calories_kcal_per_100g',
  'protein_g_per_100g',
  'carbs_g_per_100g',
  'fat_g_per_100g',
  'fiber_g_per_100g',
] as const;
const nutrientCodes = {
  sugars_g: 'sugars',
  saturated_fat_g: 'saturated_fat',
  sodium_mg: 'sodium',
  calcium_mg: 'calcium',
  iron_mg: 'iron',
  potassium_mg: 'potassium',
  vitamin_c_mg: 'vitamin_c',
};

describe('Reviewed nutrition seed', () => {
  it('loads bounded set-based statements from one payload per parent table', () => {
    const statements = migration.split('--> statement-breakpoint').length;
    // one statement per table load, not one per row: a per-row migration took tens of minutes on the hosted database
    expect(statements).toBeGreaterThan(20);
    expect(statements).toBeLessThan(60);
    expect(Buffer.byteLength(migration)).toBeLessThan(2_000_000);
    expect(migration).not.toContain('(SELECT id FROM');
    expect(migration).toContain(
      'INNER JOIN foods f ON f.slug = v.food_slug AND f.workspace_id IS NULL',
    );
    expect(migration).toContain(
      'HAVING count(i.id) <> jsonb_array_length(d.ingredients)',
    );
    expect(migration).toContain('WITH ORDINALITY');
    expect(migration.charCodeAt(0)).not.toBe(0xfeff);
  });

  it.each(['foods', 'recipes'])(
    '%s payload preserves every written column and child from the reviewed files',
    (table) => {
      const items = table === 'foods' ? foods : recipes;
      const rows = payload(table);
      expect(rows.map((row) => row.slug)).toEqual(
        items.map((item) => item.slug).sort(),
      );
      for (const row of rows) {
        const item = items.find((item) => item.slug === row.slug);
        if (!item) throw new Error(`Unexpected seed slug: ${String(row.slug)}`);
        const expected: Record<string, unknown> = {
          workspace_id: null,
          origin: 'seed',
          is_active: true,
          portions: item.portions.map(({ name_ar, weight_g, is_default }) => ({
            name_ar,
            weight_g,
            is_default,
          })),
          aliases: [
            ['aliases_ar', 'alias_ar'],
            ['aliases_en', 'alias_en'],
            ['search_hints', 'search_hint'],
          ].flatMap(([key, kind]) =>
            [
              ...new Set(((item[key] ?? []) as string[]).map((v) => v.trim())),
            ].map((alias) => ({ kind, alias })),
          ),
        };
        const columns =
          table === 'foods'
            ? [
                'slug',
                'name_ar',
                'name_en',
                'category',
                'state',
                ...macroKeys,
                'origin_note',
                'confidence',
                'review_flags',
                'usda_fdc_id',
              ]
            : [
                'slug',
                'name_ar',
                'name_en',
                'description_ar',
                'confidence',
                'review_flags',
                'meal_tags',
                'finished_weight_g',
                'prep_minutes',
                'cook_minutes',
                'youtube_video_id',
              ];
        for (const column of columns) expected[column] = item[column] ?? null;
        if (table === 'foods') {
          expected.is_verified = false;
          expected.entry_basis = 'per_100g';
          const nutrients = item.nutrients as Record<string, number | null>;
          expected.nutrients = Object.entries(nutrientCodes)
            .filter(
              ([key]) =>
                nutrients[key] !== null && nutrients[key] !== undefined,
            )
            .map(([key, code]) => ({ code, amount_per_100g: nutrients[key] }));
        } else {
          const recipe = item as SeedRecipe;
          expected.origin_note = `${String(item.origin_note)}\nYield: ${String(item.yield_note)}`;
          expected.ingredients = recipe.ingredients.map((ingredient) => ({
            ...ingredient,
            note_ar: ingredient.note_ar ?? null,
          }));
          expected.steps = item.steps_ar;
          for (const key of macroKeys) {
            let total = 0;
            for (const ingredient of recipe.ingredients) {
              const food = bySlug.get(ingredient.food_slug);
              if (!food)
                throw new Error(`Unresolved food ${ingredient.food_slug}`);
              total += (ingredient.weight_g / 100) * food[key];
            }
            expected[key] =
              Math.round((total / recipe.finished_weight_g) * 100 * 100) / 100;
          }
        }
        expect(row).toEqual(expected);
      }
    },
  );

  it('has unique food and recipe slugs', () => {
    const slugs = [...foods, ...recipes].map((item) => item.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it.each(foods)('$slug passes the real macro policy', (food) => {
    expect(
      macrosPolicy.check({
        caloriesKcalPer100g: food.calories_kcal_per_100g,
        proteinGPer100g: food.protein_g_per_100g,
        carbsGPer100g: food.carbs_g_per_100g,
        fatGPer100g: food.fat_g_per_100g,
        fiberGPer100g: food.fiber_g_per_100g,
      }),
    ).toEqual({ outcome: 'valid' });
  });

  it.each([...foods, ...recipes])(
    '$slug has positive portions and one default',
    (item) => {
      expect(
        item.portions.filter((portion) => portion.is_default),
      ).toHaveLength(1);
      for (const portion of item.portions)
        expect(portion.weight_g).toBeGreaterThan(0);
    },
  );

  it.each(recipes)(
    '$slug resolves ingredients, has plausible yield and valid calculated macros',
    (recipe) => {
      let weight = 0;
      const totals = {
        caloriesKcalPer100g: 0,
        proteinGPer100g: 0,
        carbsGPer100g: 0,
        fatGPer100g: 0,
        fiberGPer100g: 0,
      };
      for (const ingredient of recipe.ingredients) {
        const food = bySlug.get(ingredient.food_slug);
        expect(food).toBeDefined();
        if (!food)
          throw new Error(`Missing ingredient ${ingredient.food_slug}`);
        expect(ingredient.weight_g).toBeGreaterThan(0);
        weight += ingredient.weight_g;
        const factor = ingredient.weight_g / 100;
        totals.caloriesKcalPer100g += factor * food.calories_kcal_per_100g;
        totals.proteinGPer100g += factor * food.protein_g_per_100g;
        totals.carbsGPer100g += factor * food.carbs_g_per_100g;
        totals.fatGPer100g += factor * food.fat_g_per_100g;
        totals.fiberGPer100g += factor * food.fiber_g_per_100g;
      }
      expect(recipe.finished_weight_g / weight).toBeGreaterThanOrEqual(0.25);
      expect(recipe.finished_weight_g / weight).toBeLessThanOrEqual(5);
      for (const key of Object.keys(totals) as (keyof typeof totals)[]) {
        totals[key] =
          Math.round((totals[key] / recipe.finished_weight_g) * 100 * 100) /
          100;
      }
      expect(macrosPolicy.check(totals)).toEqual({ outcome: 'valid' });
      expect(totals.caloriesKcalPer100g).toBeGreaterThanOrEqual(20);
      expect(totals.caloriesKcalPer100g).toBeLessThanOrEqual(600);
    },
  );

  it('contains every food requested by the real starter policy', () => {
    for (const template of new StarterMealPlansPolicy().starterTemplates()) {
      for (const meal of template.meals) {
        for (const item of meal.items) expect(bySlug.has(item.slug)).toBe(true);
      }
    }
  });

  it('excludes every pending food by slug and name', () => {
    for (const food of pending) {
      expect(bySlug.has(food.slug)).toBe(false);
      expect(
        foods.some(
          (seed) =>
            seed.name_ar === food.name_ar || seed.name_en === food.name_en,
        ),
      ).toBe(false);
    }
  });
});
