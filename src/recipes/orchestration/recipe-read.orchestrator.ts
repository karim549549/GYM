import { RecipeNutritionPolicy } from '../policies/recipe-nutrition.policy';
import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { FoodsService } from '../../foods/foods.service';
import { RecipesQueryHandler } from '../handlers/recipes-query.handler';
import { RecipeNotFoundException } from '../exceptions/recipe-exceptions';
@Injectable()
export class RecipeReadOrchestrator {
  constructor(
    private readonly query: RecipesQueryHandler,
    private readonly transactions: TransactionManager,
    private readonly foods: FoodsService,
    private readonly nutrition: RecipeNutritionPolicy,
  ) {}
  execute(workspaceId: string, id: string) {
    return this.transactions.run(
      async () => {
        const [recipe] = await this.query.findMany([id]);
        if (!recipe) throw new RecipeNotFoundException();
        const foods = await this.foods.findVisible(
          workspaceId,
          recipe.ingredients.map((i) => i.foodId),
        );
        const portions = recipe.portions.map((portion) => ({
          ...portion,
          ...this.nutrition.perPortion(recipe, portion.weightG),
        }));
        return {
          ...recipe,
          portions,
          defaultPortion: portions.find((portion) => portion.isDefault) ?? null,
          ingredients: recipe.ingredients.map((i) => {
            const food = foods.find((f) => f.id === i.foodId);
            return {
              ...i,
              food: food
                ? {
                    id: food.id,
                    nameAr: food.nameAr,
                    nameEn: food.nameEn,
                    category: food.category,
                  }
                : undefined,
            };
          }),
        };
      },
      { workspaceId },
    );
  }
}
