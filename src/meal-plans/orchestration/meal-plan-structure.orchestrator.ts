import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { FoodsService } from '../../foods/foods.service';
import type { FoodRecord } from '../../foods/interfaces/food.interface';
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

/**
 * Takes over `MealPlansService.replaceMeals`: the builder saves the whole plan at once, so the meals
 * given become the plan. Each food must be one the coach can use (the library's or their own, and
 * not deactivated unless the plan already holds it), and a unit must be one of that food's. Grams
 * and the four macros are worked out here, once, and saved on the item: totals are then sums, and a
 * food corrected next month does not rewrite a plan a client is following.
 */
@Injectable()
export class MealPlanStructureOrchestrator extends BaseMealPlanOrchestrator {
  constructor(
    mealPlansQuery: MealPlansQueryHandler,
    totalsPolicy: MealPlanTotalsPolicy,
    transactions: TransactionManager,
    private readonly foods: FoodsService,
    private readonly structurePolicy: MealPlanStructurePolicy,
    private readonly macrosPolicy: MealMacrosPolicy,
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
        return this.withMeals(plan);
      },
      { workspaceId },
    );
  }

  /** The meals with every item worked out, or the reasons a food or unit cannot be used. */
  private async resolve(
    workspaceId: string,
    planId: string,
    meals: MealInput[],
  ): Promise<StoredMeal[]> {
    const wanted = [
      ...new Set(
        meals.flatMap((meal) =>
          meal.items.flatMap((item) => [
            item.foodId,
            ...(item.substitutes ?? []).map((sub) => sub.foodId),
          ]),
        ),
      ),
    ];
    const found = await this.foods.findVisible(workspaceId, wanted);
    const alreadyHeld = await this.mealPlansQuery.foodIdsOf(planId);
    const known = new Map(found.map((food) => [food.id, food]));
    const held = new Set(alreadyHeld);

    const problems: string[] = [];
    const check = (where: string, entry: MealSubstituteInput) => {
      const food = known.get(entry.foodId);
      if (!food || (!food.isActive && !held.has(food.id))) {
        problems.push(`${where}.foodId: unavailable`);
      } else if (
        entry.unitId &&
        !food.units.some((unit) => unit.id === entry.unitId)
      ) {
        problems.push(`${where}.unitId: not a unit of this food`);
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
      const food = known.get(entry.foodId) as FoodRecord;
      const unit = entry.unitId
        ? food.units.find((u) => u.id === entry.unitId)
        : undefined;
      return {
        foodId: food.id,
        foodName: food.nameAr,
        quantity: entry.quantity,
        unitId: entry.unitId ?? null,
        ...this.macrosPolicy.resolve(food, entry.quantity, unit),
      };
    };

    return meals.map((meal) => ({
      dayNo: meal.dayNo,
      name: meal.name,
      timeHint: meal.timeHint ?? null,
      notes: meal.notes ?? null,
      items: meal.items.map((item) => ({
        ...resolveOne(item),
        substitutes: (item.substitutes ?? []).map(resolveOne),
      })),
    }));
  }
}
