import { FoodServingPolicy } from './food-serving.policy';
import { FoodEntryBasis } from '../enums/food-entry-basis.enum';

describe('FoodServingPolicy', () => {
  const policy = new FoodServingPolicy();
  it('keeps per 100 g values and converts servings with two decimal rounding', () => {
    expect(
      policy.convert([1, 2.34], { basis: FoodEntryBasis.PER_100G }),
    ).toEqual({ outcome: 'valid', amounts: [1, 2.34] });
    expect(
      policy.convert([1, 2, 0], {
        basis: FoodEntryBasis.PER_SERVING,
        servingWeightG: 30,
      }),
    ).toEqual({ outcome: 'valid', amounts: [3.33, 6.67, 0] });
  });
  it.each([undefined, 0, -1, 5001, NaN, Infinity])(
    'refuses a serving weight of %s',
    (servingWeightG) => {
      expect(
        policy.convert([1], {
          basis: FoodEntryBasis.PER_SERVING,
          servingWeightG,
        }).outcome,
      ).toBe('invalid');
    },
  );
  it.each([-1, NaN, Infinity])('refuses nonsense amounts %s', (amount) => {
    expect(policy.convert([amount]).outcome).toBe('invalid');
  });
  it('refuses conversion overflow and handles a real zero with a tiny serving', () => {
    expect(
      policy.convert([Number.MAX_VALUE], {
        basis: FoodEntryBasis.PER_SERVING,
        servingWeightG: 1,
      }).outcome,
    ).toBe('invalid');
    expect(
      policy.convert([0], {
        basis: FoodEntryBasis.PER_SERVING,
        servingWeightG: Number.MIN_VALUE,
      }),
    ).toEqual({ outcome: 'valid', amounts: [0] });
  });
});
