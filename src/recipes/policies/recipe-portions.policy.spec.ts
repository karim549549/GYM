import { RecipePortionsPolicy } from './recipe-portions.policy';
const policy = new RecipePortionsPolicy();
const portion = { nameAr: 'plate', weightG: 200, isDefault: true };
describe('RecipePortionsPolicy', () => {
  it('accepts exactly one default', () =>
    expect(policy.check([portion, { ...portion, isDefault: false }])).toEqual({
      outcome: 'valid',
    }));
  it.each([
    { portions: [] },
    { portions: [{ ...portion, isDefault: false }] },
    { portions: [portion, portion] },
  ])('refuses invalid defaults %j', ({ portions }) =>
    expect(policy.check(portions).outcome).toBe('invalid'),
  );
});
