import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { StarterMealPlansPolicy } from '../src/meal-plans/policies/starter-meal-plans.policy';
import { HttpTestApp, type TestSession } from './support/http-test-app';

interface SeedFood {
  slug: string;
}
interface SeedRecipe {
  slug: string;
  ingredients: unknown[];
  steps_ar: string[];
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

describe('Migrated nutrition seed', () => {
  let harness: HttpTestApp;
  let session: TestSession;
  let workspaceId: string;

  beforeAll(async () => {
    harness = await HttpTestApp.start();
    ({ session } = await harness.signedUpPerson());
    const created = await harness
      .as(session)
      .post('/workspaces')
      .send({ brandName: 'Nutrition seed test' })
      .expect(201);
    workspaceId = harness.trackWorkspace((created.body as { id: string }).id);
  });
  afterAll(() => harness.stop(), 60_000);

  it('has all active shared seed foods, recipes, ingredients and steps', async () => {
    await harness.tx.run(
      async () => {
        const result = await harness.tx.db.execute<{
          foods: number;
          recipes: number;
          ingredients: number;
          steps: number;
        }>(sql`
        SELECT
          (SELECT count(*)::int FROM foods WHERE workspace_id IS NULL AND is_active) AS foods,
          (SELECT count(*)::int FROM recipes WHERE workspace_id IS NULL AND is_active) AS recipes,
          (SELECT count(*)::int FROM recipe_ingredients i JOIN recipes r ON r.id = i.recipe_id WHERE i.workspace_id IS NULL AND r.workspace_id IS NULL AND r.is_active) AS ingredients,
          (SELECT count(*)::int FROM recipe_steps s JOIN recipes r ON r.id = s.recipe_id WHERE s.workspace_id IS NULL AND r.workspace_id IS NULL AND r.is_active) AS steps
      `);
        expect(result.rows[0]).toEqual({
          foods: foods.length,
          recipes: recipes.length,
          ingredients: recipes.reduce(
            (sum, recipe) => sum + recipe.ingredients.length,
            0,
          ),
          steps: recipes.reduce(
            (sum, recipe) => sum + recipe.steps_ar.length,
            0,
          ),
        });
        const perRecipe = await harness.tx.db.execute<{
          slug: string;
          ingredients: number;
          steps: number;
        }>(sql`
        SELECT r.slug,
          (SELECT count(*)::int FROM recipe_ingredients i WHERE i.recipe_id = r.id AND i.workspace_id IS NULL) AS ingredients,
          (SELECT count(*)::int FROM recipe_steps s WHERE s.recipe_id = r.id AND s.workspace_id IS NULL) AS steps
        FROM recipes r WHERE r.workspace_id IS NULL AND r.origin = 'seed' AND r.is_active
      `);
        expect(perRecipe.rows).toEqual(
          expect.arrayContaining(
            recipes.map((recipe) => ({
              slug: recipe.slug,
              ingredients: recipe.ingredients.length,
              steps: recipe.steps_ar.length,
            })),
          ),
        );
      },
      { workspaceId },
    );
  });

  it('keeps exactly one default shared portion per seeded food and recipe', async () => {
    await harness.tx.run(
      async () => {
        const result = await harness.tx.db.execute<{
          kind: string;
          slug: string;
        }>(sql`
        SELECT 'food' AS kind, f.slug FROM foods f
        LEFT JOIN food_portions p ON p.food_id = f.id AND p.workspace_id IS NULL AND p.is_default
        WHERE f.workspace_id IS NULL AND f.origin = 'seed' AND f.is_active
        GROUP BY f.id HAVING count(p.id) <> 1
        UNION ALL
        SELECT 'recipe', r.slug FROM recipes r
        LEFT JOIN recipe_portions p ON p.recipe_id = r.id AND p.workspace_id IS NULL AND p.is_default
        WHERE r.workspace_id IS NULL AND r.origin = 'seed' AND r.is_active
        GROUP BY r.id HAVING count(p.id) <> 1
      `);
        expect(result.rows).toEqual([]);
      },
      { workspaceId },
    );
  });

  it('stores recipe macros within 0.01 of nutrition recomputed from stored ingredients', async () => {
    await harness.tx.run(
      async () => {
        const result = await harness.tx.db.execute<{
          slug: string;
          error: number;
        }>(sql`
        SELECT r.slug, greatest(
          abs(r.calories_kcal_per_100g - sum(i.weight_g * f.calories_kcal_per_100g) / r.finished_weight_g),
          abs(r.protein_g_per_100g - sum(i.weight_g * f.protein_g_per_100g) / r.finished_weight_g),
          abs(r.carbs_g_per_100g - sum(i.weight_g * f.carbs_g_per_100g) / r.finished_weight_g),
          abs(r.fat_g_per_100g - sum(i.weight_g * f.fat_g_per_100g) / r.finished_weight_g),
          abs(r.fiber_g_per_100g - sum(i.weight_g * f.fiber_g_per_100g) / r.finished_weight_g)
        )::float8 AS error
        FROM recipes r JOIN recipe_ingredients i ON i.recipe_id = r.id AND i.workspace_id IS NULL
        JOIN foods f ON f.id = i.food_id AND f.workspace_id IS NULL
        WHERE r.workspace_id IS NULL AND r.origin = 'seed' AND r.is_active GROUP BY r.id
      `);
        expect(result.rows).toHaveLength(recipes.length);
        for (const row of result.rows)
          expect({ slug: row.slug, valid: row.error <= 0.01 }).toEqual({
            slug: row.slug,
            valid: true,
          });
      },
      { workspaceId },
    );
  });

  it('fills normalized food/recipe search names and aliases, including قوطة for tomato', async () => {
    await harness.tx.run(
      async () => {
        const invalid = await harness.tx.db.execute<{
          kind: string;
          id: string;
        }>(sql`
        SELECT 'food' AS kind, id FROM foods WHERE workspace_id IS NULL AND origin = 'seed'
          AND (search_name = '' OR search_name <> normalize_search_text(concat_ws(' ', name_ar, name_en, brand)))
        UNION ALL SELECT 'recipe', id FROM recipes WHERE workspace_id IS NULL AND origin = 'seed'
          AND (search_name = '' OR search_name <> normalize_search_text(concat_ws(' ', name_ar, name_en)))
        UNION ALL SELECT 'food alias', a.id FROM food_aliases a JOIN foods f ON f.id = a.food_id
          WHERE a.workspace_id IS NULL AND f.workspace_id IS NULL AND f.origin = 'seed' AND (a.search_alias = '' OR a.search_alias <> normalize_search_text(a.alias))
        UNION ALL SELECT 'recipe alias', a.id FROM recipe_aliases a JOIN recipes r ON r.id = a.recipe_id
          WHERE a.workspace_id IS NULL AND r.workspace_id IS NULL AND r.origin = 'seed' AND (a.search_alias = '' OR a.search_alias <> normalize_search_text(a.alias))
      `);
        expect(invalid.rows).toEqual([]);
        const rice = await harness.tx.db.execute<{ search_name: string }>(
          sql`SELECT search_name FROM foods WHERE workspace_id IS NULL AND slug = 'rice-white-cooked'`,
        );
        expect(rice.rows).toHaveLength(1);
        // the food is named in Egyptian (رز); the formal spelling (ارز) is an alias that must find it
        expect(rice.rows[0].search_name).toContain('رز');
        const riceAlias = await harness.tx.db.execute<{ n: number }>(
          sql`SELECT count(*)::int AS n FROM food_aliases a JOIN foods f ON f.id = a.food_id WHERE f.workspace_id IS NULL AND f.slug = 'rice-white-cooked' AND a.search_alias LIKE '%ارز%'`,
        );
        expect(riceAlias.rows[0].n).toBeGreaterThan(0);
        expect(rice.rows[0].search_name).not.toMatch(/[أة]/);
        const tomato = await harness.tx.db.execute<{
          slug: string;
          search_alias: string;
        }>(sql`
        SELECT f.slug, a.search_alias FROM food_aliases a JOIN foods f ON f.id = a.food_id
        WHERE a.workspace_id IS NULL AND f.workspace_id IS NULL AND f.is_active AND a.search_alias = normalize_search_text('قوطة')
      `);
        expect(tomato.rows).toContainEqual({
          slug: 'tomato',
          search_alias: 'قوطه',
        });
      },
      { workspaceId },
    );
  });

  it('excludes unsourced foods and deactivates the old koshari food', async () => {
    await harness.tx.run(
      async () => {
        const result = await harness.tx.db.execute<{ slug: string }>(sql`
        SELECT slug FROM foods WHERE workspace_id IS NULL AND
          ((slug IN (${sql.join(
            pending.map((food) => sql`${food.slug}`),
            sql`, `,
          )}) AND is_active) OR (slug = 'koshari' AND is_active))
      `);
        expect(result.rows).toEqual([]);
      },
      { workspaceId },
    );
  });

  it('creates complete starter meal templates when a workspace is created', async () => {
    const listed = await harness
      .as(session)
      .get('/meal-plans?template=true&limit=100')
      .expect(200);
    const items = (listed.body as { items: { id: string; name: string }[] })
      .items;
    const expected = new StarterMealPlansPolicy().starterTemplates();
    expect(items.map((item) => item.name).sort()).toEqual(
      expected.map((item) => item.name).sort(),
    );
    await Promise.all(
      expected.map(async (template) => {
        const item = items.find((item) => item.name === template.name)!;
        const response = await harness
          .as(session)
          .get(`/meal-plans/${item.id}`)
          .expect(200);
        const plan = response.body as {
          meals: {
            items: { weightG: number; portionNameAr: string | null }[];
          }[];
        };
        expect(plan.meals).toHaveLength(template.meals.length);
        plan.meals.forEach((meal, index) => {
          expect(meal.items).toHaveLength(template.meals[index].items.length);
          for (const food of meal.items) {
            expect(food.weightG).toBeGreaterThan(0);
            expect(food.portionNameAr).not.toBeNull();
          }
        });
      }),
    );
  });
});
