import { MealMacrosPolicy } from './meal-macros.policy';

const policy = new MealMacrosPolicy();

const chicken = {
  caloriesKcalPer100g: 165,
  proteinGPer100g: 31,
  carbsGPer100g: 0,
  fatGPer100g: 3.6,
};

describe('MealMacrosPolicy', () => {
  it('works from grams: the amount over a hundred times each macro', () => {
    expect(policy.resolve(chicken, 200)).toEqual({
      weightG: 200,
      caloriesKcal: 330,
      proteinG: 62,
      carbsG: 0,
      fatG: 7.2,
    });
  });

  it('turns portions into grams first: two pieces of 120 g is 240 g', () => {
    expect(policy.resolve(chicken, 2, { weightG: 120 })).toEqual({
      weightG: 240,
      caloriesKcal: 396,
      proteinG: 74.4,
      carbsG: 0,
      fatG: 8.64,
    });
  });

  it('takes fractions of a portion: half a loaf', () => {
    expect(
      policy.resolve(
        {
          caloriesKcalPer100g: 270,
          proteinGPer100g: 9,
          carbsGPer100g: 55,
          fatGPer100g: 1.5,
        },
        0.5,
        { weightG: 100 },
      ),
    ).toEqual({
      weightG: 50,
      caloriesKcal: 135,
      proteinG: 4.5,
      carbsG: 27.5,
      fatG: 0.75,
    });
  });

  it('rounds to two decimals, so totals never carry noise', () => {
    const resolved = policy.resolve(
      {
        caloriesKcalPer100g: 89,
        proteinGPer100g: 1.1,
        carbsGPer100g: 22.8,
        fatGPer100g: 0.3,
      },
      1,
      { weightG: 118 },
    );

    expect(resolved).toEqual({
      weightG: 118,
      caloriesKcal: 105.02,
      proteinG: 1.3,
      carbsG: 26.9,
      fatG: 0.35,
    });
  });

  it('is zero for water', () => {
    expect(
      policy.resolve(
        {
          caloriesKcalPer100g: 0,
          proteinGPer100g: 0,
          carbsGPer100g: 0,
          fatGPer100g: 0,
        },
        1,
        { weightG: 240 },
      ),
    ).toEqual({
      weightG: 240,
      caloriesKcal: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
    });
  });
});
