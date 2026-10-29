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
  protected async withMeals(summary: MealPlanSummary): Promise<MealPlanRecord> {
    const stored = await this.mealPlansQuery.loadMeals(summary.id);
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
      foodName: item.foodName,
      quantity: item.quantity,
      unitId: item.unitId,
      grams: item.grams,
      kcal: item.kcal,
      proteinG: item.proteinG,
      carbG: item.carbG,
      fatG: item.fatG,
    });
    return meals.map((meal) => ({
      dayNo: meal.dayNo,
      name: meal.name,
      timeHint: meal.timeHint,
      notes: meal.notes,
      items: meal.items.map((item) => ({
        ...keep(item),
        substitutes: item.substitutes.map(keep),
      })),
    }));
  }
}
