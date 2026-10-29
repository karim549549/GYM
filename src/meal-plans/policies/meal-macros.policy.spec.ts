import { MealMacrosPolicy } from './meal-macros.policy';

const policy = new MealMacrosPolicy();

const chicken = {
  kcal100g: 165,
  protein100g: 31,
  carb100g: 0,
  fat100g: 3.6,
};

describe('MealMacrosPolicy', () => {
  it('works from grams: the amount over a hundred times each macro', () => {
    expect(policy.resolve(chicken, 200)).toEqual({
      grams: 200,
      kcal: 330,
      proteinG: 62,
      carbG: 0,
      fatG: 7.2,
    });
  });

  it('turns units into grams first: two pieces of 120 g is 240 g', () => {
    expect(policy.resolve(chicken, 2, { grams: 120 })).toEqual({
      grams: 240,
      kcal: 396,
      proteinG: 74.4,
      carbG: 0,
      fatG: 8.64,
    });
  });

  it('takes fractions of a unit: half a loaf', () => {
    expect(
      policy.resolve(
        { kcal100g: 270, protein100g: 9, carb100g: 55, fat100g: 1.5 },
        0.5,
        { grams: 100 },
      ),
    ).toEqual({ grams: 50, kcal: 135, proteinG: 4.5, carbG: 27.5, fatG: 0.75 });
  });

  it('rounds to two decimals, so totals never carry noise', () => {
    const resolved = policy.resolve(
      { kcal100g: 89, protein100g: 1.1, carb100g: 22.8, fat100g: 0.3 },
      1,
      { grams: 118 },
    );

    expect(resolved).toEqual({
      grams: 118,
      kcal: 105.02,
      proteinG: 1.3,
      carbG: 26.9,
      fatG: 0.35,
    });
  });

  it('is zero for water', () => {
    expect(
      policy.resolve(
        { kcal100g: 0, protein100g: 0, carb100g: 0, fat100g: 0 },
        1,
        { grams: 240 },
      ),
    ).toEqual({ grams: 240, kcal: 0, proteinG: 0, carbG: 0, fatG: 0 });
  });
});
