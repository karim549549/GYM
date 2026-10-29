import { Module } from '@nestjs/common';
import { FoodsController } from './foods.controller';
import { FoodsService } from './foods.service';
import { FoodsQueryHandler } from './handlers/foods-query.handler';
import { FoodCreationOrchestrator } from './orchestration/food-creation.orchestrator';
import { FoodDetailsOrchestrator } from './orchestration/food-details.orchestrator';
import { FoodListOrchestrator } from './orchestration/food-list.orchestrator';
import { FoodLookupOrchestrator } from './orchestration/food-lookup.orchestrator';
import { FoodUpdateOrchestrator } from './orchestration/food-update.orchestrator';
import { FoodMacrosPolicy } from './policies/food-macros.policy';
import { FoodUnitsPolicy } from './policies/food-units.policy';

@Module({
  controllers: [FoodsController],
  providers: [
    FoodsService,
    FoodsQueryHandler,
    FoodListOrchestrator,
    FoodDetailsOrchestrator,
    FoodCreationOrchestrator,
    FoodUpdateOrchestrator,
    FoodLookupOrchestrator,
    FoodMacrosPolicy,
    FoodUnitsPolicy,
  ],
  exports: [FoodsService],
})
export class FoodsModule {}
