import { RecipeSaveOrchestrator } from './recipe-save.orchestrator';
import { RecipeReadOrchestrator } from './recipe-read.orchestrator';
import { RecipeListOrchestrator } from './recipe-list.orchestrator';
import { RecipeLookupOrchestrator } from './recipe-lookup.orchestrator';
import { RecipesQueryHandler } from '../handlers/recipes-query.handler';
import { TransactionManager } from '../../database/transaction.manager';
import { FoodsService } from '../../foods/foods.service';
import { RecipeNutritionPolicy } from '../policies/recipe-nutrition.policy';
import { RecipePortionsPolicy } from '../policies/recipe-portions.policy';
import { RecipeOrigin } from '../../foods/enums/recipe-origin.enum';
import type { RecipeRecord, NewRecipe } from '../interfaces/recipe.interface';
const macros = {
  caloriesKcalPer100g: 150,
  proteinGPer100g: 10,
  carbsGPer100g: 20,
  fatGPer100g: 3,
  fiberGPer100g: 2,
};
const input: NewRecipe = {
  nameAr: 'Dish',
  finishedWeightG: 300,
  ingredients: ['a', 'b', 'c'].map((foodId) => ({ foodId, weightG: 100 })),
  steps: [],
  portions: [{ nameAr: 'plate', weightG: 150, isDefault: true }],
};
const record: RecipeRecord = {
  ...input,
  ...macros,
  id: 'r',
  nameEn: null,
  descriptionAr: null,
  prepMinutes: null,
  cookMinutes: null,
  youtubeVideoId: null,
  slug: null,
  mealTags: [],
  isOwn: true,
  isActive: true,
  origin: RecipeOrigin.USER,
  originNote: null,
  confidence: null,
  reviewFlags: [],
  copiedFromRecipeId: null,
  ingredients: input.ingredients.map((i, sortOrder) => ({ ...i, sortOrder })),
  steps: [],
  portions: [],
  aliases: [],
  ingredientCount: 3,
  defaultPortion: null,
};
describe('Recipe orchestration', () => {
  const query = {
    findMany: jest.fn(),
    lock: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    list: jest.fn(),
  };
  const transactions = {
    run: jest.fn(<T>(work: () => Promise<T>, _scope: unknown) => work()),
  };
  const foods = { findVisible: jest.fn() };
  const nutrition = new RecipeNutritionPolicy();
  const save = new RecipeSaveOrchestrator(
    query as unknown as RecipesQueryHandler,
    transactions as unknown as TransactionManager,
    foods as unknown as FoodsService,
    nutrition,
    new RecipePortionsPolicy(),
  );
  beforeEach(() => {
    jest.clearAllMocks();
    query.findMany.mockResolvedValue([record]);
    query.create.mockResolvedValue('r');
    foods.findVisible.mockResolvedValue(
      ['a', 'b', 'c'].map((id) => ({
        id,
        ...macros,
        isActive: true,
        nameAr: id,
        nameEn: null,
        category: 'protein',
      })),
    );
  });
  it('creates calculated user nutrition in workspace scope', async () => {
    await save.execute('w', input);
    expect(transactions.run).toHaveBeenCalledWith(expect.any(Function), {
      workspaceId: 'w',
    });
    expect(query.create).toHaveBeenCalledWith(
      'w',
      expect.objectContaining(input),
      macros,
      undefined,
    );
  });
  it('recomputes on yield changes', async () => {
    query.findMany.mockResolvedValue([{ ...record, portions: input.portions }]);
    await save.execute('w', { finishedWeightG: 600 }, 'r');
    expect(query.lock).toHaveBeenCalledWith('r');
    expect(query.update).toHaveBeenCalledWith(
      'w',
      'r',
      { finishedWeightG: 600 },
      expect.objectContaining({ caloriesKcalPer100g: 75 }),
    );
  });
  it('keeps saved nutrition for metadata edits and does not query inactive ingredients', async () => {
    query.findMany.mockResolvedValue([{ ...record, portions: input.portions }]);
    await save.execute('w', { isActive: false }, 'r');
    expect(foods.findVisible).not.toHaveBeenCalled();
    expect(query.update).toHaveBeenCalledWith(
      'w',
      'r',
      { isActive: false },
      undefined,
    );
  });
  it('refuses shared edits and hidden recipes', async () => {
    query.findMany.mockResolvedValue([{ ...record, isOwn: false }]);
    await expect(save.execute('w', {}, 'r')).rejects.toMatchObject({
      response: { code: 'RECIPE_NOT_EDITABLE' },
    });
    query.findMany.mockResolvedValue([]);
    await expect(save.execute('w', {}, 'r')).rejects.toMatchObject({
      response: { code: 'RECIPE_NOT_FOUND' },
    });
    expect(query.update).not.toHaveBeenCalled();
  });
  it('copies a shared recipe with provenance and children', async () => {
    query.findMany.mockResolvedValue([
      { ...record, isOwn: false, portions: input.portions },
    ]);
    await save.execute('w', { nameAr: 'Copy' }, 'r', true);
    expect(query.create).toHaveBeenCalledWith(
      'w',
      expect.objectContaining({
        nameAr: 'Copy',
        ingredients: record.ingredients,
      }),
      macros,
      'r',
    );
    expect(query.update).not.toHaveBeenCalled();
  });
  it.each([
    { found: [] },
    { found: [{ id: 'a', ...macros, isActive: false }] },
  ])('refuses invisible or inactive ingredients $found', async ({ found }) => {
    foods.findVisible.mockResolvedValue(found);
    await expect(save.execute('w', input)).rejects.toMatchObject({
      response: { code: 'INVALID_RECIPE' },
    });
    expect(query.create).not.toHaveBeenCalled();
  });
  it('refuses invalid nutrition and defaults before writing', async () => {
    await expect(
      save.execute('w', { ...input, finishedWeightG: 10 }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_RECIPE' } });
    await expect(
      save.execute('w', { ...input, portions: [] }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_RECIPE' } });
    expect(query.create).not.toHaveBeenCalled();
  });
  it('reads ingredient names through FoodsService', async () => {
    const read = new RecipeReadOrchestrator(
      query as unknown as RecipesQueryHandler,
      transactions as unknown as TransactionManager,
      foods as unknown as FoodsService,
      nutrition,
    );
    expect((await read.execute('w', 'r')).ingredients[0].food?.nameAr).toBe(
      'a',
    );
    query.findMany.mockResolvedValue([]);
    await expect(read.execute('w', 'r')).rejects.toMatchObject({
      response: { code: 'RECIPE_NOT_FOUND' },
    });
  });
  it('scopes lists and lookups including inactive rows for existing plans', async () => {
    const list = new RecipeListOrchestrator(
      query as unknown as RecipesQueryHandler,
      transactions as unknown as TransactionManager,
    );
    await list.execute('w', {});
    expect(query.list).toHaveBeenCalledWith({});
    const lookup = new RecipeLookupOrchestrator(
      query as unknown as RecipesQueryHandler,
      transactions as unknown as TransactionManager,
    );
    expect(await lookup.execute('w', ['r'])).toEqual([record]);
  });
});
