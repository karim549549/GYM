import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { PackagesModule } from '../packages/packages.module';
import { PaymentsModule } from '../payments/payments.module';
import { RemindersModule } from '../reminders/reminders.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ClientSubscriptionsController } from './client-subscriptions.controller';
import { SubscriptionsQueryHandler } from './handlers/subscriptions-query.handler';
import { SubscriptionCancellationOrchestrator } from './orchestration/subscription-cancellation.orchestrator';
import { SubscriptionCreationOrchestrator } from './orchestration/subscription-creation.orchestrator';
import { SubscriptionDetailsOrchestrator } from './orchestration/subscription-details.orchestrator';
import { SubscriptionFreezeListOrchestrator } from './orchestration/subscription-freeze-list.orchestrator';
import { SubscriptionFreezeOrchestrator } from './orchestration/subscription-freeze.orchestrator';
import { SubscriptionListOrchestrator } from './orchestration/subscription-list.orchestrator';
import { SubscriptionPaymentOrchestrator } from './orchestration/subscription-payment.orchestrator';
import { SubscriptionResumeOrchestrator } from './orchestration/subscription-resume.orchestrator';
import { SubscriptionFirstStartOrchestrator } from './orchestration/subscription-first-start.orchestrator';
import { SubscriptionStatisticsOrchestrator } from './orchestration/subscription-statistics.orchestrator';
import { SubscriptionSummaryOrchestrator } from './orchestration/subscription-summary.orchestrator';
import { SubscriptionUpdateOrchestrator } from './orchestration/subscription-update.orchestrator';
import { SubscriptionDatesPolicy } from './policies/subscription-dates.policy';
import { SubscriptionFreezePolicy } from './policies/subscription-freeze.policy';
import { SubscriptionStatePolicy } from './policies/subscription-state.policy';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [
    ClientsModule,
    PackagesModule,
    PaymentsModule,
    RemindersModule,
    WorkspacesModule,
  ],
  controllers: [ClientSubscriptionsController, SubscriptionsController],
  providers: [
    SubscriptionsService,
    SubscriptionsQueryHandler,
    SubscriptionCreationOrchestrator,
    SubscriptionListOrchestrator,
    SubscriptionDetailsOrchestrator,
    SubscriptionUpdateOrchestrator,
    SubscriptionFreezeOrchestrator,
    SubscriptionResumeOrchestrator,
    SubscriptionCancellationOrchestrator,
    SubscriptionFreezeListOrchestrator,
    SubscriptionPaymentOrchestrator,
    SubscriptionSummaryOrchestrator,
    SubscriptionStatisticsOrchestrator,
    SubscriptionFirstStartOrchestrator,
    SubscriptionDatesPolicy,
    SubscriptionStatePolicy,
    SubscriptionFreezePolicy,
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
