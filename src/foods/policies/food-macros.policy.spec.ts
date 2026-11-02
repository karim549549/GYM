import { FoodMacrosPolicy } from './food-macros.policy';

const policy = new FoodMacrosPolicy();

const chicken = {
  caloriesKcalPer100g: 165,
  proteinGPer100g: 31,
  carbsGPer100g: 0,
  fatGPer100g: 3.6,
  fiberGPer100g: 0,
};
const problemsOf = (food: Partial<typeof chicken>) => {
  const result = policy.check({ ...chicken, ...food });
  return result.outcome === 'invalid' ? result.problems : [];
};

describe('FoodMacrosPolicy', () => {
  it('accepts numbers that agree with each other', () => {
    expect(policy.check(chicken).outcome).toBe('valid');
  });

  it('accepts water, which has nothing in it', () => {
    expect(
      policy.check({
        caloriesKcalPer100g: 0,
        proteinGPer100g: 0,
        carbsGPer100g: 0,
        fatGPer100g: 0,
        fiberGPer100g: 0,
      }).outcome,
    ).toBe('valid');
  });

  it('accepts pure oil, which is a hundred weightG of fat', () => {
    expect(
      policy.check({
        caloriesKcalPer100g: 884,
        proteinGPer100g: 0,
        carbsGPer100g: 0,
        fatGPer100g: 100,
        fiberGPer100g: 0,
      }).outcome,
    ).toBe('valid');
  });

  it('refuses calories that the macros cannot make (a slipped decimal)', () => {
    expect(problemsOf({ caloriesKcalPer100g: 16.5 })).toEqual([
      'caloriesKcalPer100g: inconsistent',
    ]);
    expect(problemsOf({ caloriesKcalPer100g: 1650 })).toEqual([
      'caloriesKcalPer100g: inconsistent',
    ]);
  });

  it('allows a quarter either way, since tables round and fibre has calories of its own', () => {
    expect(problemsOf({ caloriesKcalPer100g: 150 })).toEqual([]);
    expect(problemsOf({ caloriesKcalPer100g: 185 })).toEqual([]);
  });

  it('is generous about small numbers, where a few calories is a rounding', () => {
    expect(
      problemsOf({
        caloriesKcalPer100g: 18,
        proteinGPer100g: 0.9,
        carbsGPer100g: 3.9,
        fatGPer100g: 0.2,
      }),
    ).toEqual([]);
    expect(
      problemsOf({
        caloriesKcalPer100g: 1,
        proteinGPer100g: 0,
        carbsGPer100g: 0.3,
        fatGPer100g: 0,
      }),
    ).toEqual([]);
  });

  it('refuses more than a hundred weightG of macros in a hundred weightG of food', () => {
    expect(
      problemsOf({
        caloriesKcalPer100g: 500,
        proteinGPer100g: 60,
        carbsGPer100g: 40,
        fatGPer100g: 20,
      }),
    ).toContain('macros: more than 100 g');
  });

  it('refuses more fibre than there are carbohydrates', () => {
    expect(
      problemsOf({
        carbsGPer100g: 5,
        fiberGPer100g: 9,
        caloriesKcalPer100g: 150,
      }),
    ).toEqual(['fiberGPer100g: more than the carbohydrates']);
  });

  it('reports every problem at once', () => {
    expect(
      problemsOf({
        caloriesKcalPer100g: 5000,
        proteinGPer100g: 90,
        carbsGPer100g: 5,
        fatGPer100g: 20,
        fiberGPer100g: 9,
      }).sort(),
    ).toEqual(
      [
        'fiberGPer100g: more than the carbohydrates',
        'caloriesKcalPer100g: inconsistent',
        'macros: more than 100 g',
      ].sort(),
    );
  });
});
