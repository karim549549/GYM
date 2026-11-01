import { Injectable } from '@nestjs/common';
import type { FoodMacros } from '../../foods/interfaces/food.interface';
import type { RecipeIngredientInput } from '../interfaces/recipe.interface';
@Injectable()
export class RecipeNutritionPolicy {
  calculate(
    ingredients: (RecipeIngredientInput & { food: FoodMacros })[],
    finishedWeightG: number,
  ): FoodMacros {
    const sum = (key: keyof FoodMacros) =>
      Math.round(
        (ingredients.reduce(
          (total, i) => total + (i.weightG / 100) * i.food[key],
          0,
        ) /
          finishedWeightG) *
          100 *
          100,
      ) / 100;
    return {
      caloriesKcalPer100g: sum('caloriesKcalPer100g'),
      proteinGPer100g: sum('proteinGPer100g'),
      carbsGPer100g: sum('carbsGPer100g'),
      fatGPer100g: sum('fatGPer100g'),
      fiberGPer100g: sum('fiberGPer100g'),
    };
  }
  perPortion(macros: FoodMacros, weightG: number) {
    const value = (n: number) => Math.round(((n * weightG) / 100) * 100) / 100;
    return {
      caloriesKcal: value(macros.caloriesKcalPer100g),
      proteinG: value(macros.proteinGPer100g),
      carbsG: value(macros.carbsGPer100g),
      fatG: value(macros.fatGPer100g),
      fiberG: value(macros.fiberGPer100g),
    };
  }

  check(
    ingredients: RecipeIngredientInput[],
    finishedWeightG: number,
    macros: FoodMacros,
  ): { outcome: 'valid' } | { outcome: 'invalid'; problems: string[] } {
    const problems: string[] = [];
    const weight = ingredients.reduce((total, i) => total + i.weightG, 0);
    if (finishedWeightG < weight * 0.25 || finishedWeightG > weight * 5)
      problems.push(
        'finishedWeightG: outside 0.25 to 5 times ingredient weight',
      );
    if (new Set(ingredients.map((i) => i.foodId)).size !== ingredients.length)
      problems.push('ingredients: duplicate food');
    const worked =
      4 * macros.proteinGPer100g +
      4 * macros.carbsGPer100g +
      9 * macros.fatGPer100g;
    if (
      Math.abs(macros.caloriesKcalPer100g - worked) >
      Math.max(20, worked * 0.25)
    )
      problems.push('caloriesKcalPer100g: inconsistent');
    if (
      macros.proteinGPer100g + macros.carbsGPer100g + macros.fatGPer100g >
      100
    )
      problems.push('macros: more than 100 g');
    if (macros.fiberGPer100g > macros.carbsGPer100g)
      problems.push('fiberGPer100g: more than carbohydrates');
    if (macros.caloriesKcalPer100g < 20 || macros.caloriesKcalPer100g > 600)
      problems.push('caloriesKcalPer100g: outside 20 to 600');
    return problems.length
      ? { outcome: 'invalid', problems }
      : { outcome: 'valid' };
  }
}
