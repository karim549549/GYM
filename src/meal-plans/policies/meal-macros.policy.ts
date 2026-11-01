import { Injectable } from '@nestjs/common';
import type { FoodMacros } from '../../foods/interfaces/food.interface';
import type { ResolvedMacros } from '../interfaces/meal-plan.interface';

/**
 * What an amount of food or recipe is worth. Macros are per 100 grams, always, so the arithmetic is the same
 * everywhere: the amount in grams over a hundred, times the macro. An amount in portions is turned
 * into grams first by the portion's weight. Rounded to two decimals so that totals carry no noise.
 */
@Injectable()
export class MealMacrosPolicy {
  resolve(
    nutrition: Omit<FoodMacros, 'fiberGPer100g'> & { fiberGPer100g?: number },
    quantity: number,
    portion?: { weightG: number },
  ): ResolvedMacros {
    const weightG = this.round(portion ? quantity * portion.weightG : quantity);
    const share = weightG / 100;
    return {
      weightG,
      caloriesKcal: this.round(share * nutrition.caloriesKcalPer100g),
      proteinG: this.round(share * nutrition.proteinGPer100g),
      carbsG: this.round(share * nutrition.carbsGPer100g),
      fatG: this.round(share * nutrition.fatGPer100g),
    };
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
