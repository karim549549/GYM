import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { ExercisesModule } from '../exercises/exercises.module';
import { SubscriptionDatesPolicy } from '../subscriptions/policies/subscription-dates.policy';
import { PlansQueryHandler } from './handlers/plans-query.handler';
import { PlanActivationOrchestrator } from './orchestration/plan-activation.orchestrator';
import { PlanActiveClientsOrchestrator } from './orchestration/plan-active-clients.orchestrator';
import { PlanCreationOrchestrator } from './orchestration/plan-creation.orchestrator';
import { PlanDetailsOrchestrator } from './orchestration/plan-details.orchestrator';
import { PlanEndingOrchestrator } from './orchestration/plan-ending.orchestrator';
import { PlanListOrchestrator } from './orchestration/plan-list.orchestrator';
import { PlanRemovalOrchestrator } from './orchestration/plan-removal.orchestrator';
import { PlanStructureOrchestrator } from './orchestration/plan-structure.orchestrator';
import { PlanTemplateSavingOrchestrator } from './orchestration/plan-template-saving.orchestrator';
import { PlanUpdateOrchestrator } from './orchestration/plan-update.orchestrator';
import { StarterPlansOrchestrator } from './orchestration/starter-plans.orchestrator';
import { PlanStructurePolicy } from './policies/plan-structure.policy';
import { StarterPlansPolicy } from './policies/starter-plans.policy';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';

@Module({
  imports: [ClientsModule, ExercisesModule],
  controllers: [PlansController],
  providers: [
    PlansService,
    PlansQueryHandler,
    PlanCreationOrchestrator,
    PlanListOrchestrator,
    PlanDetailsOrchestrator,
    PlanUpdateOrchestrator,
    PlanStructureOrchestrator,
    PlanActivationOrchestrator,
    PlanActiveClientsOrchestrator,
    PlanEndingOrchestrator,
    PlanTemplateSavingOrchestrator,
    PlanRemovalOrchestrator,
    StarterPlansOrchestrator,
    PlanStructurePolicy,
    StarterPlansPolicy,
    // the dates rule is shared with subscriptions; it holds no state
    SubscriptionDatesPolicy,
  ],
  exports: [PlansService],
})
export class PlansModule {}
