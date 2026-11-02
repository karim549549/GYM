import { Module } from '@nestjs/common';
import { FoodsModule } from '../foods/foods.module';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';
import { RecipesQueryHandler } from './handlers/recipes-query.handler';
import { RecipeReadOrchestrator } from './orchestration/recipe-read.orchestrator';
import { RecipeListOrchestrator } from './orchestration/recipe-list.orchestrator';
import { RecipeLookupOrchestrator } from './orchestration/recipe-lookup.orchestrator';
import { RecipeSaveOrchestrator } from './orchestration/recipe-save.orchestrator';
import { RecipeNutritionPolicy } from './policies/recipe-nutrition.policy';
import { RecipePortionsPolicy } from './policies/recipe-portions.policy';
@Module({
  imports: [FoodsModule],
  controllers: [RecipesController],
  providers: [
    RecipesService,
    RecipesQueryHandler,
    RecipeReadOrchestrator,
    RecipeListOrchestrator,
    RecipeLookupOrchestrator,
    RecipeSaveOrchestrator,
    RecipeNutritionPolicy,
    RecipePortionsPolicy,
  ],
  exports: [RecipesService],
})
export class RecipesModule {}
