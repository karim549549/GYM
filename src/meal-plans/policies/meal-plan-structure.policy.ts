import { Injectable } from '@nestjs/common';
import type { MealInput } from '../interfaces/meal-plan.interface';

export type MealPlanStructureCheck =
  { outcome: 'valid' } | { outcome: 'invalid'; problems: string[] };

/**
 * What makes a set of meals sensible beyond each field being well formed: a substitute is a different
 * food from the item it stands in for, and offered once; and a day is not given more than ten meals.
 * Every problem at once, so the coach fixes them in one go.
 */
@Injectable()
export class MealPlanStructurePolicy {
  private static readonly MAX_MEALS_PER_DAY = 10;

  check(meals: MealInput[]): MealPlanStructureCheck {
    const problems: string[] = [];

    const perDay = new Map<number | null, number>();
    for (const meal of meals) {
      perDay.set(meal.weekday, (perDay.get(meal.weekday) ?? 0) + 1);
    }
    for (const [weekday, total] of perDay) {
      if (total > MealPlanStructurePolicy.MAX_MEALS_PER_DAY) {
        problems.push(
          `meals: more than ${MealPlanStructurePolicy.MAX_MEALS_PER_DAY} on day ${weekday}`,
        );
      }
    }

    meals.forEach((meal, m) =>
      meal.items.forEach((item, i) => {
        const seen = new Set<string>();
        (item.substitutes ?? []).forEach((sub, s) => {
          const where = `meals[${m}].items[${i}].substitutes[${s}]`;
          const key = sub.recipeId
            ? `recipe:${sub.recipeId}`
            : `food:${sub.foodId}`;
          const itemKey = item.recipeId
            ? `recipe:${item.recipeId}`
            : `food:${item.foodId}`;
          if (key === itemKey) {
            problems.push(`${where}: same as the item`);
          } else if (seen.has(key)) {
            problems.push(`${where}: duplicate`);
          }
          seen.add(key);
        });
      }),
    );

    return problems.length > 0
      ? { outcome: 'invalid', problems }
      : { outcome: 'valid' };
  }
}
