import { FoodMacrosPolicy } from './food-macros.policy';

const policy = new FoodMacrosPolicy();

const chicken = {
  kcal100g: 165,
  protein100g: 31,
  carb100g: 0,
  fat100g: 3.6,
  fiber100g: 0,
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
        kcal100g: 0,
        protein100g: 0,
        carb100g: 0,
        fat100g: 0,
        fiber100g: 0,
      }).outcome,
    ).toBe('valid');
  });

  it('accepts pure oil, which is a hundred grams of fat', () => {
    expect(
      policy.check({
        kcal100g: 884,
        protein100g: 0,
        carb100g: 0,
        fat100g: 100,
        fiber100g: 0,
      }).outcome,
    ).toBe('valid');
  });

  it('refuses calories that the macros cannot make (a slipped decimal)', () => {
    expect(problemsOf({ kcal100g: 16.5 })).toEqual(['kcal100g: inconsistent']);
    expect(problemsOf({ kcal100g: 1650 })).toEqual(['kcal100g: inconsistent']);
  });

  it('allows a quarter either way, since tables round and fibre has calories of its own', () => {
    expect(problemsOf({ kcal100g: 150 })).toEqual([]);
    expect(problemsOf({ kcal100g: 185 })).toEqual([]);
  });

  it('is generous about small numbers, where a few calories is a rounding', () => {
    expect(
      problemsOf({
        kcal100g: 18,
        protein100g: 0.9,
        carb100g: 3.9,
        fat100g: 0.2,
      }),
    ).toEqual([]);
    expect(
      problemsOf({ kcal100g: 1, protein100g: 0, carb100g: 0.3, fat100g: 0 }),
    ).toEqual([]);
  });

  it('refuses more than a hundred grams of macros in a hundred grams of food', () => {
    expect(
      problemsOf({ kcal100g: 500, protein100g: 60, carb100g: 40, fat100g: 20 }),
    ).toContain('macros: more than 100 g');
  });

  it('refuses more fibre than there are carbohydrates', () => {
    expect(problemsOf({ carb100g: 5, fiber100g: 9, kcal100g: 150 })).toEqual([
      'fiber100g: more than the carbohydrates',
    ]);
  });

  it('reports every problem at once', () => {
    expect(
      problemsOf({
        kcal100g: 5000,
        protein100g: 90,
        carb100g: 5,
        fat100g: 20,
        fiber100g: 9,
      }).sort(),
    ).toEqual(
      [
        'fiber100g: more than the carbohydrates',
        'kcal100g: inconsistent',
        'macros: more than 100 g',
      ].sort(),
    );
  });
});
