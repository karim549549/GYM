import { FoodPortionsPolicy } from './food-portions.policy';

const policy = new FoodPortionsPolicy();

describe('FoodPortionsPolicy', () => {
  it('makes the first portion the default when none was marked', () => {
    expect(
      policy.normalise([
        { nameAr: 'كوب', weightG: 160 },
        { nameAr: 'مغرفة', weightG: 80 },
      ]),
    ).toEqual({
      outcome: 'valid',
      portions: [
        { nameAr: 'كوب', weightG: 160, isDefault: true },
        { nameAr: 'مغرفة', weightG: 80, isDefault: false },
      ],
    });
  });

  it('keeps the default the coach chose', () => {
    expect(
      policy.normalise([
        { nameAr: 'كوب', weightG: 160 },
        { nameAr: 'مغرفة', weightG: 80, isDefault: true },
      ]),
    ).toMatchObject({
      outcome: 'valid',
      portions: [{ isDefault: false }, { isDefault: true }],
    });
  });

  it('accepts a food with no portions: it is measured in weightG', () => {
    expect(policy.normalise([])).toEqual({ outcome: 'valid', portions: [] });
  });

  it('refuses two defaults', () => {
    expect(
      policy.normalise([
        { nameAr: 'كوب', weightG: 160, isDefault: true },
        { nameAr: 'مغرفة', weightG: 80, isDefault: true },
      ]),
    ).toEqual({
      outcome: 'invalid',
      problems: ['portions: more than one default'],
    });
  });

  it('refuses the same portion named twice', () => {
    expect(
      policy.normalise([
        { nameAr: 'كوب', weightG: 160 },
        { nameAr: ' كوب ', weightG: 200 },
      ]),
    ).toEqual({ outcome: 'invalid', problems: ['portions[1]: duplicate'] });
  });
});
