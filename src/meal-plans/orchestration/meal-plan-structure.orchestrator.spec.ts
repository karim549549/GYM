import { Test, type TestingModule } from '@nestjs/testing';
import { MealPlanStructureOrchestrator } from './meal-plan-structure.orchestrator';
import { MealPlansQueryHandler } from '../handlers/meal-plans-query.handler';
import { MealPlanTotalsPolicy } from '../policies/meal-plan-totals.policy';
import { MealPlanStructurePolicy } from '../policies/meal-plan-structure.policy';
import { MealMacrosPolicy } from '../policies/meal-macros.policy';
import { TransactionManager } from '../../database/transaction.manager';
import { FoodsService } from '../../foods/foods.service';
import { RecipesService } from '../../recipes/recipes.service';
import { MealPlanStatus } from '../enums/meal-plan-status.enum';
import type { MealInput, StoredMeal } from '../interfaces/meal-plan.interface';
const macros = {
  caloriesKcalPer100g: 150,
  proteinGPer100g: 10,
  carbsGPer100g: 20,
  fatGPer100g: 3,
  fiberGPer100g: 2,
};
const recipe = {
  id: 'r',
  nameAr: 'Dish',
  ...macros,
  isActive: true,
  portions: [{ id: 'rp', nameAr: 'plate', weightG: 200 }],
};
const food = {
  id: 'f',
  nameAr: 'Food',
  ...macros,
  isActive: true,
  portions: [{ id: 'fp', weightG: 50 }],
};
describe('MealPlanStructureOrchestrator recipes', () => {
  const query = {
    findSummary: jest.fn(),
    foodIdsOf: jest.fn(),
    replaceMeals: jest.fn(),
    loadMeals: jest.fn(),
  };
  const transactions = {
    run: jest.fn(<T>(work: () => Promise<T>, _scope: unknown) => work()),
  };
  const foods = { findVisible: jest.fn() };
  const recipes = { findVisibleByIds: jest.fn() };
  let module: TestingModule;
  let orchestrator: MealPlanStructureOrchestrator;
  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        MealPlanStructureOrchestrator,
        { provide: MealPlansQueryHandler, useValue: query },
        { provide: TransactionManager, useValue: transactions },
        { provide: FoodsService, useValue: foods },
        { provide: RecipesService, useValue: recipes },
        MealPlanTotalsPolicy,
        MealPlanStructurePolicy,
        MealMacrosPolicy,
      ],
    }).compile();
    orchestrator = module.get(MealPlanStructureOrchestrator);
  });
  afterAll(() => module.close());
  const meals: MealInput[] = [
    {
      weekday: null,
      name: 'Lunch',
      items: [
        { recipeId: 'r', quantity: 100 },
        { recipeId: 'r', quantity: 2, portionId: 'rp' },
        {
          foodId: 'f',
          quantity: 1,
          portionId: 'fp',
          substitutes: [{ recipeId: 'r', quantity: 50 }],
        },
      ],
    },
  ];
  beforeEach(() => {
    jest.clearAllMocks();
    query.findSummary.mockResolvedValue({
      id: 'p',
      status: MealPlanStatus.DRAFT,
    });
    query.foodIdsOf.mockResolvedValue([]);
    query.loadMeals.mockResolvedValue([]);
    foods.findVisible.mockResolvedValue([food]);
    recipes.findVisibleByIds.mockResolvedValue([recipe]);
  });
  it('looks up each owner once and copies grams, names and nutrition for items and substitutes', async () => {
    await orchestrator.execute('w', 'p', meals);
    expect(foods.findVisible).toHaveBeenCalledWith('w', ['f']);
    expect(recipes.findVisibleByIds).toHaveBeenCalledWith('w', ['r']);
    expect(transactions.run).toHaveBeenCalledWith(expect.any(Function), {
      workspaceId: 'w',
    });
    const stored = query.replaceMeals.mock.calls[0][2] as StoredMeal[];
    expect(stored[0].items[0]).toMatchObject({
      foodId: null,
      recipeId: 'r',
      itemName: 'Dish',
      weightG: 100,
      caloriesKcal: 150,
    });
    expect(stored[0].items[1]).toMatchObject({
      portionId: 'rp',
      weightG: 400,
      caloriesKcal: 600,
    });
    expect(stored[0].items[2]).toMatchObject({
      foodId: 'f',
      recipeId: null,
      weightG: 50,
      substitutes: [
        expect.objectContaining({
          recipeId: 'r',
          weightG: 50,
          caloriesKcal: 75,
        }),
      ],
    });
  });
  it.each([{ found: [] }, { found: [{ ...recipe, isActive: false }] }])(
    'rejects unavailable recipes $found',
    async ({ found }) => {
      recipes.findVisibleByIds.mockResolvedValue(found);
      await expect(orchestrator.execute('w', 'p', meals)).rejects.toMatchObject(
        {
          response: {
            code: 'FOOD_NOT_AVAILABLE',
            details: expect.arrayContaining([
              'meals[0].items[0].recipeId: unavailable',
            ]),
          },
        },
      );
      expect(query.replaceMeals).not.toHaveBeenCalled();
    },
  );
  it('rejects the wrong portion on recipes and recipe substitutes', async () => {
    const bad: MealInput[] = [
      {
        weekday: null,
        name: 'Lunch',
        items: [
          { recipeId: 'r', quantity: 1, portionId: 'fp' },
          {
            foodId: 'f',
            quantity: 1,
            substitutes: [{ recipeId: 'r', quantity: 1, portionId: 'fp' }],
          },
        ],
      },
    ];
    await expect(orchestrator.execute('w', 'p', bad)).rejects.toMatchObject({
      response: {
        code: 'FOOD_NOT_AVAILABLE',
        details: expect.arrayContaining([
          'meals[0].items[0].portionId: not a portion of this item',
          'meals[0].items[1].substitutes[0].portionId: not a portion of this item',
        ]),
      },
    });
  });
  it('keeps the existing held-food exception for foods', async () => {
    foods.findVisible.mockResolvedValue([{ ...food, isActive: false }]);
    query.foodIdsOf.mockResolvedValue(['f']);
    await orchestrator.execute('w', 'p', meals);
    expect(query.replaceMeals).toHaveBeenCalled();
  });
  it('reads recipe portion labels via the owner even when inactive', async () => {
    query.loadMeals.mockResolvedValue([
      {
        weekday: null,
        name: 'Lunch',
        items: [
          {
            ...macros,
            recipeId: 'r',
            portionId: 'rp',
            substitutes: [],
            caloriesKcal: 150,
            proteinG: 10,
            carbsG: 20,
            fatG: 3,
          },
        ],
      },
    ]);
    const saved = await orchestrator.execute('w', 'p', meals);
    expect(saved.meals[0].items[0].portionNameAr).toBe('plate');
  });
  it('does not write ended, missing or structurally invalid plans', async () => {
    query.findSummary.mockResolvedValue(null);
    await expect(orchestrator.execute('w', 'p', meals)).rejects.toMatchObject({
      response: { code: 'MEAL_PLAN_NOT_FOUND' },
    });
    query.findSummary.mockResolvedValue({
      id: 'p',
      status: MealPlanStatus.ENDED,
    });
    await expect(orchestrator.execute('w', 'p', meals)).rejects.toMatchObject({
      response: { code: 'MEAL_PLAN_ENDED' },
    });
    query.findSummary.mockResolvedValue({
      id: 'p',
      status: MealPlanStatus.DRAFT,
    });
    await expect(
      orchestrator.execute('w', 'p', [
        {
          weekday: null,
          name: 'Lunch',
          items: [
            {
              recipeId: 'r',
              quantity: 1,
              substitutes: [{ recipeId: 'r', quantity: 1 }],
            },
          ],
        },
      ]),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_MEAL_PLAN_STRUCTURE' },
    });
    expect(query.replaceMeals).not.toHaveBeenCalled();
  });
});
