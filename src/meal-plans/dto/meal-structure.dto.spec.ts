import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MealSubstituteDto, MealItemDto, MealDto } from './meal-structure.dto';

describe('MealDto weekday', () => {
  it.each([null, 1, 7])('accepts %s', async (weekday) => {
    expect(
      await validate(
        plainToInstance(MealDto, { weekday, name: 'Lunch', items: [] }),
      ),
    ).toEqual([]);
  });
  it.each([undefined, 0, -1, 8, 1.5])('refuses %s', async (weekday) => {
    expect(
      (
        await validate(
          plainToInstance(MealDto, { weekday, name: 'Lunch', items: [] }),
        )
      ).some((error) => error.property === 'weekday'),
    ).toBe(true);
  });
});

describe('Meal item food or recipe choice', () => {
  const id = '10000000-0000-4000-8000-000000000001';
  it.each([{ foodId: id }, { recipeId: id }])(
    'accepts one choice %j',
    async (choice) =>
      expect(
        await validate(
          plainToInstance(MealSubstituteDto, { ...choice, quantity: 100 }),
        ),
      ).toEqual([]),
  );
  it.each([
    {},
    { foodId: id, recipeId: id },
    { recipeId: 'bad' },
    { foodId: null, recipeId: null },
  ])('rejects choice %j', async (choice) =>
    expect(
      (
        await validate(
          plainToInstance(MealSubstituteDto, { ...choice, quantity: 100 }),
        )
      ).length,
    ).toBeGreaterThan(0),
  );
  it('validates substitute choices recursively', async () =>
    expect(
      (
        await validate(
          plainToInstance(MealItemDto, {
            foodId: id,
            quantity: 100,
            substitutes: [{ foodId: id, recipeId: id, quantity: 1 }],
          }),
        )
      ).length,
    ).toBeGreaterThan(0));
});
