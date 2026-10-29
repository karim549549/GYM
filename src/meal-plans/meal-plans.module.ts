import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { FoodsModule } from '../foods/foods.module';
import { SubscriptionDatesPolicy } from '../subscriptions/policies/subscription-dates.policy';
import { MealPlansQueryHandler } from './handlers/meal-plans-query.handler';
import { MealPlansController } from './meal-plans.controller';
import { MealPlansService } from './meal-plans.service';
import { MealPlanActivationOrchestrator } from './orchestration/meal-plan-activation.orchestrator';
import { MealPlanCreationOrchestrator } from './orchestration/meal-plan-creation.orchestrator';
import { MealPlanDetailsOrchestrator } from './orchestration/meal-plan-details.orchestrator';
import { MealPlanEndingOrchestrator } from './orchestration/meal-plan-ending.orchestrator';
import { MealPlanListOrchestrator } from './orchestration/meal-plan-list.orchestrator';
import { MealPlanRemovalOrchestrator } from './orchestration/meal-plan-removal.orchestrator';
import { MealPlanStructureOrchestrator } from './orchestration/meal-plan-structure.orchestrator';
import { MealPlanTemplateSavingOrchestrator } from './orchestration/meal-plan-template-saving.orchestrator';
import { MealPlanUpdateOrchestrator } from './orchestration/meal-plan-update.orchestrator';
import { StarterMealPlansOrchestrator } from './orchestration/starter-meal-plans.orchestrator';
import { MealMacrosPolicy } from './policies/meal-macros.policy';
import { MealPlanStructurePolicy } from './policies/meal-plan-structure.policy';
import { MealPlanTotalsPolicy } from './policies/meal-plan-totals.policy';
import { StarterMealPlansPolicy } from './policies/starter-meal-plans.policy';

@Module({
  imports: [ClientsModule, FoodsModule],
  controllers: [MealPlansController],
  providers: [
    MealPlansService,
    MealPlansQueryHandler,
    MealPlanCreationOrchestrator,
    MealPlanListOrchestrator,
    MealPlanDetailsOrchestrator,
    MealPlanUpdateOrchestrator,
    MealPlanStructureOrchestrator,
    MealPlanActivationOrchestrator,
    MealPlanEndingOrchestrator,
    MealPlanTemplateSavingOrchestrator,
    MealPlanRemovalOrchestrator,
    StarterMealPlansOrchestrator,
    MealMacrosPolicy,
    MealPlanStructurePolicy,
    MealPlanTotalsPolicy,
    StarterMealPlansPolicy,
    // the dates rule is shared with subscriptions; it holds no state
    SubscriptionDatesPolicy,
  ],
  exports: [MealPlansService],
})
export class MealPlansModule {}
