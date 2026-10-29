import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { FoodsService } from '../../foods/foods.service';
import type { FoodRecord } from '../../foods/interfaces/food.interface';
import { MealPlansQueryHandler } from '../handlers/meal-plans-query.handler';
import type { StoredMeal } from '../interfaces/meal-plan.interface';
import { MealMacrosPolicy } from '../policies/meal-macros.policy';
import { StarterMealPlansPolicy } from '../policies/starter-meal-plans.policy';

/**
 * Takes over `MealPlansService.seedStarterTemplates`. It runs inside the transaction that has just
 * created the workspace, whose scope the database already set, so it asks for no scope of its own
 * (that would be refused). Outside such a transaction there is no scope and row level security
 * blocks the insert: it fails closed. Amounts are worked out the same way as for a coach's own.
 */
@Injectable()
export class StarterMealPlansOrchestrator {
  constructor(
    private readonly mealPlansQuery: MealPlansQueryHandler,
    private readonly foods: FoodsService,
    private readonly starterPlans: StarterMealPlansPolicy,
    private readonly macrosPolicy: MealMacrosPolicy,
    private readonly transactions: TransactionManager,
  ) {}

  execute(workspaceId: string): Promise<void> {
    return this.transactions.run(async () => {
      const templates = this.starterPlans.starterTemplates();
      const slugs = [
        ...new Set(
          templates.flatMap((t) =>
            t.meals.flatMap((m) => m.items.map((i) => i.slug)),
          ),
        ),
      ];
      const library = new Map(
        (await this.foods.findLibraryBySlugs(slugs)).map((food) => [
          food.slug,
          food,
        ]),
      );

      const created = await this.mealPlansQuery.createTemplates(
        workspaceId,
        templates.map(({ meals: _meals, ...plan }) => plan),
      );
      await this.mealPlansQuery.insertMeals(
        workspaceId,
        templates.map((template, index) => ({
          planId: created[index].id,
          meals: template.meals.map((meal): StoredMeal => ({
            dayNo: 0,
            name: meal.name,
            timeHint: meal.timeHint,
            notes: null,
            items: meal.items.map((item) => {
              const food = library.get(item.slug) as FoodRecord | undefined;
              if (!food) {
                // a library without its own foods is a broken deployment, not a coach's mistake
                throw new Error(`The food database is missing "${item.slug}"`);
              }
              const unit = food.units.find((u) => u.isDefault);
              return {
                foodId: food.id,
                foodName: food.nameAr,
                quantity: item.quantity,
                unitId: unit?.id ?? null,
                ...this.macrosPolicy.resolve(food, item.quantity, unit),
                substitutes: [],
              };
            }),
          })),
        })),
      );
    });
  }
}
