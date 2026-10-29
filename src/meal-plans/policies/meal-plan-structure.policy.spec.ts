import type { MealInput } from '../interfaces/meal-plan.interface';
import { MealPlanStructurePolicy } from './meal-plan-structure.policy';

const policy = new MealPlanStructurePolicy();

const meal = (items: MealInput['items']): MealInput => ({
  dayNo: 0,
  name: 'Lunch',
  items,
});
const problems = (meals: MealInput[]) => {
  const result = policy.check(meals);
  return result.outcome === 'invalid' ? result.problems : [];
};

describe('MealPlanStructurePolicy', () => {
  it('accepts meals with items and substitutes of other foods', () => {
    expect(
      policy.check([
        meal([
          {
            foodId: 'rice',
            quantity: 1,
            substitutes: [
              { foodId: 'pasta', quantity: 1 },
              { foodId: 'potato', quantity: 1 },
            ],
          },
        ]),
      ]).outcome,
    ).toBe('valid');
  });

  it('accepts a plan with no meals yet', () => {
    expect(policy.check([]).outcome).toBe('valid');
  });

  it('refuses a substitute that is the very food it replaces', () => {
    expect(
      problems([
        meal([
          {
            foodId: 'rice',
            quantity: 1,
            substitutes: [{ foodId: 'rice', quantity: 2 }],
          },
        ]),
      ]),
    ).toEqual(['meals[0].items[0].substitutes[0]: same as the item']);
  });

  it('refuses the same substitute twice on one item', () => {
    expect(
      problems([
        meal([
          {
            foodId: 'rice',
            quantity: 1,
            substitutes: [
              { foodId: 'pasta', quantity: 1 },
              { foodId: 'pasta', quantity: 2 },
            ],
          },
        ]),
      ]),
    ).toEqual(['meals[0].items[0].substitutes[1]: duplicate']);
  });

  it('allows the same food as a substitute on different items', () => {
    expect(
      problems([
        meal([
          {
            foodId: 'rice',
            quantity: 1,
            substitutes: [{ foodId: 'pasta', quantity: 1 }],
          },
          {
            foodId: 'bread',
            quantity: 1,
            substitutes: [{ foodId: 'pasta', quantity: 1 }],
          },
        ]),
      ]),
    ).toEqual([]);
  });

  it('refuses more than 70 meals, ten to a day of the week', () => {
    const many = Array.from({ length: 11 }, () => meal([]));

    expect(problems(many)).toEqual(['meals: more than 10 on day 0']);
  });
});
