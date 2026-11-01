import { FoodWritePreparationOrchestrator } from './orchestration/food-write-preparation.orchestrator';
import { FoodServingPolicy } from './policies/food-serving.policy';
import { FoodBarcodePolicy } from './policies/food-barcode.policy';
import { FoodPublicationQueryHandler } from './handlers/food-publication-query.handler';
import { FoodPublicationRequestOrchestrator } from './orchestration/food-publication-request.orchestrator';
import { FoodPublicationListOrchestrator } from './orchestration/food-publication-list.orchestrator';
import { FoodPublicationReviewOrchestrator } from './orchestration/food-publication-review.orchestrator';
import { BillingModule } from '../billing/billing.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
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
import { FoodPortionsPolicy } from './policies/food-portions.policy';
import { AdminFoodPublicationController } from './admin-food-publication.controller';
import { FoodPublicationController } from './food-publication.controller';

@Module({
  imports: [BillingModule, WorkspacesModule],
  controllers: [
    FoodsController,
    AdminFoodPublicationController,
    FoodPublicationController,
  ],
  providers: [
    FoodsService,
    FoodWritePreparationOrchestrator,
    FoodServingPolicy,
    FoodBarcodePolicy,
    FoodPublicationQueryHandler,
    FoodPublicationRequestOrchestrator,
    FoodPublicationListOrchestrator,
    FoodPublicationReviewOrchestrator,
    FoodsQueryHandler,
    FoodListOrchestrator,
    FoodDetailsOrchestrator,
    FoodCreationOrchestrator,
    FoodUpdateOrchestrator,
    FoodLookupOrchestrator,
    FoodMacrosPolicy,
    FoodPortionsPolicy,
  ],
  exports: [FoodsService],
})
export class FoodsModule {}
