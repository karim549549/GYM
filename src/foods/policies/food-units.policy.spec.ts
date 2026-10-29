import { FoodUnitsPolicy } from './food-units.policy';

const policy = new FoodUnitsPolicy();

describe('FoodUnitsPolicy', () => {
  it('makes the first unit the default when none was marked', () => {
    expect(
      policy.normalise([
        { labelAr: 'كوب', grams: 160 },
        { labelAr: 'مغرفة', grams: 80 },
      ]),
    ).toEqual({
      outcome: 'valid',
      units: [
        { labelAr: 'كوب', grams: 160, isDefault: true },
        { labelAr: 'مغرفة', grams: 80, isDefault: false },
      ],
    });
  });

  it('keeps the default the coach chose', () => {
    expect(
      policy.normalise([
        { labelAr: 'كوب', grams: 160 },
        { labelAr: 'مغرفة', grams: 80, isDefault: true },
      ]),
    ).toMatchObject({
      outcome: 'valid',
      units: [{ isDefault: false }, { isDefault: true }],
    });
  });

  it('accepts a food with no units: it is measured in grams', () => {
    expect(policy.normalise([])).toEqual({ outcome: 'valid', units: [] });
  });

  it('refuses two defaults', () => {
    expect(
      policy.normalise([
        { labelAr: 'كوب', grams: 160, isDefault: true },
        { labelAr: 'مغرفة', grams: 80, isDefault: true },
      ]),
    ).toEqual({
      outcome: 'invalid',
      problems: ['units: more than one default'],
    });
  });

  it('refuses the same unit named twice', () => {
    expect(
      policy.normalise([
        { labelAr: 'كوب', grams: 160 },
        { labelAr: ' كوب ', grams: 200 },
      ]),
    ).toEqual({ outcome: 'invalid', problems: ['units[1]: duplicate'] });
  });
});
