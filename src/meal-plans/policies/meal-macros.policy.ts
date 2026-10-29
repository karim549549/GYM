import { Injectable } from '@nestjs/common';
import type { FoodMacros } from '../../foods/interfaces/food.interface';
import type { ResolvedMacros } from '../interfaces/meal-plan.interface';

/**
 * What an amount of food is worth. Macros are per 100 grams, always, so the arithmetic is the same
 * everywhere: the amount in grams over a hundred, times the macro. An amount in units is turned
 * into grams first by the unit's weight. Rounded to two decimals so that totals carry no noise.
 */
@Injectable()
export class MealMacrosPolicy {
  resolve(
    food: Omit<FoodMacros, 'fiber100g'> & { fiber100g?: number },
    quantity: number,
    unit?: { grams: number },
  ): ResolvedMacros {
    const grams = this.round(unit ? quantity * unit.grams : quantity);
    const share = grams / 100;
    return {
      grams,
      kcal: this.round(share * food.kcal100g),
      proteinG: this.round(share * food.protein100g),
      carbG: this.round(share * food.carb100g),
      fatG: this.round(share * food.fat100g),
    };
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
