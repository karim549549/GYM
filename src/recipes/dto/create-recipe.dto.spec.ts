import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateRecipeDto } from './create-recipe.dto';
import { UpdateRecipeDto } from './update-recipe.dto';
import { CopyRecipeDto } from './copy-recipe.dto';
import { ListRecipesQueryDto } from './list-recipes.query.dto';
import { RecipeParamsDto } from './recipe-params.dto';
const id = '10000000-0000-4000-8000-000000000001';
const input = {
  nameAr: 'Recipe',
  finishedWeightG: 300,
  ingredients: Array.from({ length: 3 }, () => ({ foodId: id, weightG: 100 })),
  steps: [],
  portions: [{ nameAr: 'plate', weightG: 100, isDefault: true }],
};
describe('Recipe DTOs', () => {
  it('accepts create and nested children', async () =>
    expect(await validate(plainToInstance(CreateRecipeDto, input))).toEqual(
      [],
    ));
  it.each([
    { ingredients: [] },
    { ingredients: [{}] },
    { portions: [] },
    { portions: [{ nameAr: '', weightG: 0, isDefault: 'yes' }] },
    { steps: [{ instruction: '' }] },
    { aliases: [{ kind: 'bad', alias: '' }] },
    { finishedWeightG: 0 },
    { mealTags: ['bad'] },
    { youtubeVideoId: '1234567890!' },
    { youtubeVideoId: 'short' },
    { nameAr: '' },
  ])('rejects malformed create %j', async (change) =>
    expect(
      (
        await validate(
          plainToInstance(CreateRecipeDto, { ...input, ...change }),
        )
      ).length,
    ).toBeGreaterThan(0),
  );
  it.each(['a_b-c123456', '___________'])(
    'accepts YouTube alphabet %s',
    async (youtubeVideoId) =>
      expect(
        await validate(
          plainToInstance(CreateRecipeDto, { ...input, youtubeVideoId }),
        ),
      ).toEqual([]),
  );
  it('accepts empty PATCH and nullable fields', async () => {
    expect(await validate(plainToInstance(UpdateRecipeDto, {}))).toEqual([]);
    expect(
      await validate(
        plainToInstance(UpdateRecipeDto, {
          nameEn: null,
          descriptionAr: null,
          prepMinutes: null,
          cookMinutes: null,
          youtubeVideoId: null,
        }),
      ),
    ).toEqual([]);
  });
  it.each([
    'nameAr',
    'finishedWeightG',
    'ingredients',
    'steps',
    'portions',
    'mealTags',
    'aliases',
    'isActive',
  ])('rejects null PATCH %s', async (field) =>
    expect(
      (await validate(plainToInstance(UpdateRecipeDto, { [field]: null })))
        .length,
    ).toBeGreaterThan(0),
  );
  it('validates query, params and copy', async () => {
    expect(
      await validate(
        plainToInstance(ListRecipesQueryDto, {
          scope: 'mine',
          mealTag: 'lunch',
          includeInactive: 'true',
        }),
      ),
    ).toEqual([]);
    expect(
      (
        await validate(
          plainToInstance(ListRecipesQueryDto, {
            scope: 'bad',
            mealTag: 'bad',
            includeInactive: 'yes',
          }),
        )
      ).length,
    ).toBe(3);
    expect(await validate(plainToInstance(RecipeParamsDto, { id }))).toEqual(
      [],
    );
    expect(
      (await validate(plainToInstance(RecipeParamsDto, { id: 'bad' }))).length,
    ).toBe(1);
    expect(await validate(plainToInstance(CopyRecipeDto, {}))).toEqual([]);
    expect(
      (await validate(plainToInstance(CopyRecipeDto, { nameAr: '' }))).length,
    ).toBe(1);
  });
});
