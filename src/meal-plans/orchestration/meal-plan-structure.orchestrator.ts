import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { FoodsService } from '../../foods/foods.service';
import { RecipesService } from '../../recipes/recipes.service';
import type { FoodMacros } from '../../foods/interfaces/food.interface';
import { MealPlanStatus } from '../enums/meal-plan-status.enum';
import {
  FoodNotAvailableException,
  InvalidMealPlanStructureException,
  MealPlanEndedException,
} from '../exceptions/meal-plan-exceptions';
import { MealPlansQueryHandler } from '../handlers/meal-plans-query.handler';
import type {
  MealInput,
  MealPlanRecord,
  MealSubstituteInput,
  StoredMeal,
  StoredMealSubstitute,
} from '../interfaces/meal-plan.interface';
import { MealMacrosPolicy } from '../policies/meal-macros.policy';
import { MealPlanStructurePolicy } from '../policies/meal-plan-structure.policy';
import { MealPlanTotalsPolicy } from '../policies/meal-plan-totals.policy';
import { BaseMealPlanOrchestrator } from './base-meal-plan.orchestrator';

/** Resolves foods and recipes once when the whole meal structure is saved. */
@Injectable()
export class MealPlanStructureOrchestrator extends BaseMealPlanOrchestrator {
  constructor(
    mealPlansQuery: MealPlansQueryHandler,
    totalsPolicy: MealPlanTotalsPolicy,
    transactions: TransactionManager,
    private readonly foods: FoodsService,
    private readonly structurePolicy: MealPlanStructurePolicy,
    private readonly macrosPolicy: MealMacrosPolicy,
    private readonly recipes: RecipesService,
  ) {
    super(mealPlansQuery, totalsPolicy, transactions);
  }

  execute(
    workspaceId: string,
    planId: string,
    meals: MealInput[],
  ): Promise<MealPlanRecord> {
    return this.transactions.run(
      async () => {
        const plan = await this.mustFind(planId);
        if (plan.status === MealPlanStatus.ENDED) {
          throw new MealPlanEndedException();
        }

        const checked = this.structurePolicy.check(meals);
        if (checked.outcome === 'invalid') {
          throw new InvalidMealPlanStructureException(checked.problems);
        }

        const stored = await this.resolve(workspaceId, planId, meals);
        await this.mealPlansQuery.replaceMeals(workspaceId, planId, stored);
        return this.withMeals(plan, workspaceId);
      },
      { workspaceId },
    );
  }

  /** The meals with every item worked out, or the reasons a food or portion cannot be used. */
  private async resolve(
    workspaceId: string,
    planId: string,
    meals: MealInput[],
  ): Promise<StoredMeal[]> {
    const entries = meals.flatMap((meal) =>
      meal.items.flatMap((item) => [item, ...(item.substitutes ?? [])]),
    );
    const foodIds = [
      ...new Set(entries.flatMap((e) => (e.foodId ? [e.foodId] : []))),
    ];
    const recipeIds = [
      ...new Set(entries.flatMap((e) => (e.recipeId ? [e.recipeId] : []))),
    ];
    const found = await this.foods.findVisible(workspaceId, foodIds);
    const foundRecipes = await this.recipes.findVisibleByIds(
      workspaceId,
      recipeIds,
    );
    const alreadyHeld = await this.mealPlansQuery.foodIdsOf(planId);
    type NutritionalItem = FoodMacros & {
      id: string;
      nameAr: string;
      isActive: boolean;
      portions: { id: string; weightG: number }[];
    };
    const known = new Map<string, NutritionalItem>([
      ...found.map((food) => [`food:${food.id}`, food] as const),
      ...foundRecipes.map((recipe) => [`recipe:${recipe.id}`, recipe] as const),
    ]);
    const held = new Set(alreadyHeld);
    const key = (entry: MealSubstituteInput) =>
      entry.recipeId ? `recipe:${entry.recipeId}` : `food:${entry.foodId}`;

    const problems: string[] = [];
    const check = (where: string, entry: MealSubstituteInput) => {
      const food = known.get(key(entry));
      if (
        !food ||
        (!food.isActive && (entry.recipeId !== undefined || !held.has(food.id)))
      ) {
        problems.push(
          `${where}.${entry.recipeId ? 'recipeId' : 'foodId'}: unavailable`,
        );
      } else if (
        entry.portionId &&
        !food.portions.some((portion) => portion.id === entry.portionId)
      ) {
        problems.push(`${where}.portionId: not a portion of this item`);
      }
    };
    meals.forEach((meal, m) =>
      meal.items.forEach((item, i) => {
        check(`meals[${m}].items[${i}]`, item);
        (item.substitutes ?? []).forEach((sub, s) =>
          check(`meals[${m}].items[${i}].substitutes[${s}]`, sub),
        );
      }),
    );
    if (problems.length > 0) {
      throw new FoodNotAvailableException(problems);
    }

    const resolveOne = (entry: MealSubstituteInput): StoredMealSubstitute => {
      const food = known.get(key(entry)) as NutritionalItem;
      const portion = entry.portionId
        ? food.portions.find((u) => u.id === entry.portionId)
        : undefined;
      return {
        foodId: entry.foodId ?? null,
        recipeId: entry.recipeId ?? null,
        itemName: food.nameAr,
        quantity: entry.quantity,
        portionId: entry.portionId ?? null,
        ...this.macrosPolicy.resolve(food, entry.quantity, portion),
      };
    };

    return meals.map((meal) => ({
      weekday: meal.weekday,
      name: meal.name,
      suggestedTime: meal.suggestedTime ?? null,
      notes: meal.notes ?? null,
      items: meal.items.map((item) => ({
        ...resolveOne(item),
        substitutes: (item.substitutes ?? []).map(resolveOne),
      })),
    }));
  }
}
