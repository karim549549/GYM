import { readFileSync } from 'node:fs';
import { RecipeNutritionPolicy } from './recipe-nutrition.policy';

type SeedFood = {
  slug: string;
  calories_kcal_per_100g: number;
  protein_g_per_100g: number;
  carbs_g_per_100g: number;
  fat_g_per_100g: number;
  fiber_g_per_100g: number;
};
type SeedRecipe = {
  slug: string;
  finished_weight_g: number;
  ingredients: { food_slug: string; weight_g: number }[];
};
const foods = JSON.parse(
  readFileSync('seed-data/foods.json', 'utf8'),
) as SeedFood[];
const recipes = JSON.parse(
  readFileSync('seed-data/recipes.json', 'utf8'),
) as SeedRecipe[];
const policy = new RecipeNutritionPolicy();
describe('RecipeNutritionPolicy', () => {
  it('covers all 51 seeded recipes', () => expect(recipes).toHaveLength(51));
  it.each(recipes)(
    'reproduces generator nutrition and accepts $slug',
    (recipe) => {
      const ingredients = recipe.ingredients.map((i) => {
        const food = foods.find((f) => f.slug === i.food_slug)!;
        return {
          foodId: i.food_slug,
          weightG: i.weight_g,
          food: {
            caloriesKcalPer100g: food.calories_kcal_per_100g,
            proteinGPer100g: food.protein_g_per_100g,
            carbsGPer100g: food.carbs_g_per_100g,
            fatGPer100g: food.fat_g_per_100g,
            fiberGPer100g: food.fiber_g_per_100g,
          },
        };
      });
      const result = policy.calculate(ingredients, recipe.finished_weight_g);
      const keys = [
        'calories_kcal_per_100g',
        'protein_g_per_100g',
        'carbs_g_per_100g',
        'fat_g_per_100g',
        'fiber_g_per_100g',
      ] as const;
      const expected = keys.map(
        (key) =>
          Math.round(
            (recipe.ingredients.reduce(
              (sum, i) =>
                sum +
                (i.weight_g / 100) *
                  foods.find((f) => f.slug === i.food_slug)![key],
              0,
            ) /
              recipe.finished_weight_g) *
              100 *
              100,
          ) / 100,
      );
      Object.values(result).forEach((value, i) =>
        expect(Math.abs(value - expected[i])).toBeLessThanOrEqual(0.01),
      );
      expect(
        policy.check(ingredients, recipe.finished_weight_g, result),
      ).toEqual({ outcome: 'valid' });
    },
  );
});

describe('RecipeNutritionPolicy rejection rules', () => {
  const ingredients = [
    { foodId: 'a', weightG: 100 },
    { foodId: 'b', weightG: 100 },
    { foodId: 'c', weightG: 100 },
  ];
  const macros = {
    caloriesKcalPer100g: 150,
    proteinGPer100g: 10,
    carbsGPer100g: 20,
    fatGPer100g: 3,
    fiberGPer100g: 2,
  };
  it.each([74, 1501])('rejects impossible yield %s', (weight) =>
    expect(policy.check(ingredients, weight, macros).outcome).toBe('invalid'),
  );
  it('rejects duplicate ingredients', () =>
    expect(
      policy.check([ingredients[0], ingredients[0]], 200, macros).outcome,
    ).toBe('invalid'));
  it.each([
    { caloriesKcalPer100g: 19 },
    { caloriesKcalPer100g: 601 },
    { caloriesKcalPer100g: 300 },
    { proteinGPer100g: 90 },
    { fiberGPer100g: 21 },
  ])('rejects contradictory macros %j', (change) =>
    expect(
      policy.check(ingredients, 300, { ...macros, ...change }).outcome,
    ).toBe('invalid'),
  );
  it.each([75, 1500])('accepts yield boundary %s', (weight) =>
    expect(policy.check(ingredients, weight, macros).outcome).toBe('valid'),
  );
});

describe('Recipe portion nutrition', () => {
  it('scales all five values and rounds to two decimals', () =>
    expect(
      policy.perPortion(
        {
          caloriesKcalPer100g: 150,
          proteinGPer100g: 10,
          carbsGPer100g: 20,
          fatGPer100g: 3,
          fiberGPer100g: 2,
        },
        123,
      ),
    ).toEqual({
      caloriesKcal: 184.5,
      proteinG: 12.3,
      carbsG: 24.6,
      fatG: 3.69,
      fiberG: 2.46,
    }));
});
