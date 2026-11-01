import { Injectable } from '@nestjs/common';
import type { FoodMacros } from '../interfaces/food.interface';

export type FoodMacrosCheck =
  { outcome: 'valid' } | { outcome: 'invalid'; problems: string[] };

/**
 * Whether the numbers of a food contradict themselves. Everything else in nutrition is arithmetic on
 * them, so a slipped decimal in a coach's own food would quietly wreck every plan that uses it:
 * better refused where it is typed. Protein and carbohydrate carry about 4 calories a gram and fat
 * about 9; tables round, and fibre and alcohol add their own, so a quarter either way is allowed.
 */
@Injectable()
export class FoodMacrosPolicy {
  private static readonly KCAL_PER_GRAM = { protein: 4, carb: 4, fat: 9 };
  private static readonly TOLERANCE = 0.25;
  /** Few calories are all rounding, so a small food is allowed this many either way. */
  private static readonly SMALL_SLACK = 20;

  check(food: FoodMacros): FoodMacrosCheck {
    const problems: string[] = [];
    const { protein, carb, fat } = FoodMacrosPolicy.KCAL_PER_GRAM;

    const worked =
      protein * food.proteinGPer100g +
      carb * food.carbsGPer100g +
      fat * food.fatGPer100g;
    const slack = Math.max(
      FoodMacrosPolicy.SMALL_SLACK,
      FoodMacrosPolicy.TOLERANCE * worked,
    );
    if (Math.abs(food.caloriesKcalPer100g - worked) > slack) {
      problems.push('caloriesKcalPer100g: inconsistent');
    }
    if (food.proteinGPer100g + food.carbsGPer100g + food.fatGPer100g > 100) {
      problems.push('macros: more than 100 g');
    }
    if (food.fiberGPer100g > food.carbsGPer100g) {
      problems.push('fiberGPer100g: more than the carbohydrates');
    }

    return problems.length > 0
      ? { outcome: 'invalid', problems }
      : { outcome: 'valid' };
  }
}
