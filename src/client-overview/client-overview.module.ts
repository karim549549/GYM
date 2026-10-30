import { Module } from '@nestjs/common';
import { CheckinsModule } from '../checkins/checkins.module';
import { ClientsModule } from '../clients/clients.module';
import { PlansModule } from '../plans/plans.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ClientOverviewController } from './client-overview.controller';
import { ClientOverviewService } from './client-overview.service';
import { ClientOverviewListOrchestrator } from './orchestration/client-overview-list.orchestrator';

/**
 * The clients list with a summary of each client. It owns no table: the subscription, the plan and
 * the check-ins belong to other modules, which already depend on `clients`, so the list that joins
 * them is its own module (as `onboarding` is for creating a workspace).
 */
@Module({
  imports: [ClientsModule, SubscriptionsModule, PlansModule, CheckinsModule],
  controllers: [ClientOverviewController],
  providers: [ClientOverviewService, ClientOverviewListOrchestrator],
})
export class ClientOverviewModule {}
