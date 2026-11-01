import type { FoodMacros } from '../../foods/interfaces/food.interface';
import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { FoodsService } from '../../foods/foods.service';
import { RecipesQueryHandler } from '../handlers/recipes-query.handler';
import {
  RecipeNotFoundException,
  RecipeNotEditableException,
  InvalidRecipeException,
} from '../exceptions/recipe-exceptions';
import { RecipeNutritionPolicy } from '../policies/recipe-nutrition.policy';
import { RecipePortionsPolicy } from '../policies/recipe-portions.policy';
import type {
  NewRecipe,
  RecipeChanges,
  RecipeRecord,
} from '../interfaces/recipe.interface';
@Injectable()
export class RecipeSaveOrchestrator {
  constructor(
    private readonly query: RecipesQueryHandler,
    private readonly transactions: TransactionManager,
    private readonly foods: FoodsService,
    private readonly nutrition: RecipeNutritionPolicy,
    private readonly portions: RecipePortionsPolicy,
  ) {}
  execute(
    workspaceId: string,
    changes: RecipeChanges,
    id?: string,
    copy = false,
  ): Promise<RecipeRecord> {
    return this.transactions.run(
      async () => {
        if (id && !copy) await this.query.lock(id);
        const existing = id ? (await this.query.findMany([id]))[0] : undefined;
        if (id && !existing) throw new RecipeNotFoundException();
        if (existing && !copy && !existing.isOwn)
          throw new RecipeNotEditableException();
        const input: NewRecipe = {
          nameAr: changes.nameAr ?? existing!.nameAr,
          nameEn:
            changes.nameEn !== undefined ? changes.nameEn : existing?.nameEn,
          descriptionAr:
            changes.descriptionAr !== undefined
              ? changes.descriptionAr
              : existing?.descriptionAr,
          finishedWeightG: changes.finishedWeightG ?? existing!.finishedWeightG,
          prepMinutes:
            changes.prepMinutes !== undefined
              ? changes.prepMinutes
              : existing?.prepMinutes,
          cookMinutes:
            changes.cookMinutes !== undefined
              ? changes.cookMinutes
              : existing?.cookMinutes,
          youtubeVideoId:
            changes.youtubeVideoId !== undefined
              ? changes.youtubeVideoId
              : existing?.youtubeVideoId,
          mealTags: changes.mealTags ?? existing?.mealTags ?? [],
          ingredients: changes.ingredients ?? existing!.ingredients,
          steps: changes.steps ?? existing!.steps,
          portions: changes.portions ?? existing!.portions,
          aliases: changes.aliases ?? existing?.aliases ?? [],
        };
        const portionCheck = this.portions.check(input.portions);
        if (portionCheck.outcome === 'invalid')
          throw new InvalidRecipeException(portionCheck.problems);
        const recompute =
          !existing ||
          copy ||
          changes.ingredients !== undefined ||
          changes.finishedWeightG !== undefined;
        let macros: FoodMacros | undefined;
        if (recompute) {
          const foods = await this.foods.findVisible(
            workspaceId,
            input.ingredients.map((i) => i.foodId),
          );
          const ingredients = input.ingredients.map((i) => ({
            ...i,
            food: foods.find((f) => f.id === i.foodId && f.isActive),
          }));
          const unavailable = ingredients.flatMap((i, index) =>
            i.food ? [] : [`ingredients[${index}].foodId: unavailable`],
          );
          if (unavailable.length) throw new InvalidRecipeException(unavailable);
          macros = this.nutrition.calculate(
            ingredients.map((i) => ({ ...i, food: i.food! })),
            input.finishedWeightG,
          );
          const checked = this.nutrition.check(
            input.ingredients,
            input.finishedWeightG,
            macros,
          );
          if (checked.outcome === 'invalid')
            throw new InvalidRecipeException(checked.problems);
        }
        let savedId: string;
        if (existing && !copy) {
          await this.query.update(workspaceId, existing.id, changes, macros);
          savedId = existing.id;
        } else
          savedId = await this.query.create(
            workspaceId,
            input,
            macros!,
            copy ? id : undefined,
          );
        const saved = (await this.query.findMany([savedId]))[0];
        const portions = saved.portions.map((portion) => ({
          ...portion,
          ...this.nutrition.perPortion(saved, portion.weightG),
        }));
        return {
          ...saved,
          portions,
          defaultPortion: portions.find((portion) => portion.isDefault) ?? null,
        };
      },
      { workspaceId },
    );
  }
}
