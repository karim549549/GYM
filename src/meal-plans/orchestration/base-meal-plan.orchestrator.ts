import { Inject } from '@nestjs/common';
import { RecipesService } from '../../recipes/recipes.service';
import { TransactionManager } from '../../database/transaction.manager';
import { MealPlanNotFoundException } from '../exceptions/meal-plan-exceptions';
import { MealPlansQueryHandler } from '../handlers/meal-plans-query.handler';
import type {
  MealPlanRecord,
  MealPlanSummary,
  MealSubstituteRecord,
  StoredMeal,
  StoredMealRecord,
} from '../interfaces/meal-plan.interface';
import { MealPlanTotalsPolicy } from '../policies/meal-plan-totals.policy';

/** What the flows that read or copy a whole meal plan share. Call it inside the flow's transaction. */
export abstract class BaseMealPlanOrchestrator {
  @Inject(RecipesService) private readonly recipeLookup: RecipesService;
  constructor(
    protected readonly mealPlansQuery: MealPlansQueryHandler,
    protected readonly totalsPolicy: MealPlanTotalsPolicy,
    protected readonly transactions: TransactionManager,
  ) {}

  protected async mustFind(planId: string): Promise<MealPlanSummary> {
    const found = await this.mealPlansQuery.findSummary(planId);
    if (!found) {
      throw new MealPlanNotFoundException();
    }
    return found;
  }

  /** The plan with its meals and the totals worked out from what was saved on each item. */
  protected async withMeals(
    summary: MealPlanSummary,
    workspaceId: string,
  ): Promise<MealPlanRecord> {
    const stored = await this.mealPlansQuery.loadMeals(summary.id);
    const recipeIds = [
      ...new Set(
        stored.flatMap((meal) =>
          meal.items
            .flatMap((item) => [item, ...item.substitutes])
            .flatMap((item) => (item.recipeId ? [item.recipeId] : [])),
        ),
      ),
    ];
    const recipes = recipeIds.length
      ? await this.recipeLookup.findVisibleByIds(workspaceId, recipeIds)
      : [];
    for (const meal of stored)
      for (const item of meal.items.flatMap((item) => [
        item,
        ...item.substitutes,
      ])) {
        if (item.recipeId)
          item.portionNameAr =
            recipes
              .find((r) => r.id === item.recipeId)
              ?.portions.find((p) => p.id === item.portionId)?.nameAr ?? null;
      }
    const meals = stored.map((meal) => ({
      ...meal,
      totals: this.totalsPolicy.mealTotals(meal.items),
    }));
    return {
      ...summary,
      meals,
      days: this.totalsPolicy.days(summary, meals),
    };
  }

  /** A plan's meals as they would be stored again: a copy keeps the numbers as they were saved. */
  protected asStored(meals: StoredMealRecord[]): StoredMeal[] {
    const keep = (item: MealSubstituteRecord) => ({
      foodId: item.foodId,
      recipeId: item.recipeId,
      itemName: item.itemName,
      quantity: item.quantity,
      portionId: item.portionId,
      weightG: item.weightG,
      caloriesKcal: item.caloriesKcal,
      proteinG: item.proteinG,
      carbsG: item.carbsG,
      fatG: item.fatG,
    });
    return meals.map((meal) => ({
      weekday: meal.weekday,
      name: meal.name,
      suggestedTime: meal.suggestedTime,
      notes: meal.notes,
      items: meal.items.map((item) => ({
        ...keep(item),
        substitutes: item.substitutes.map(keep),
      })),
    }));
  }
}
