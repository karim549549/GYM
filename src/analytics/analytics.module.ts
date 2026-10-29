import { Module } from '@nestjs/common';
import { CheckinsModule } from '../checkins/checkins.module';
import { ClientsModule } from '../clients/clients.module';
import { ConsentsModule } from '../consents/consents.module';
import { MeasurementsModule } from '../measurements/measurements.module';
import { PaymentsModule } from '../payments/payments.module';
import { SubscriptionDatesPolicy } from '../subscriptions/policies/subscription-dates.policy';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { BusinessAnalyticsOrchestrator } from './orchestration/business-analytics.orchestrator';
import { ClientProgressOrchestrator } from './orchestration/client-progress.orchestrator';
import { BusinessAnalyticsPolicy } from './policies/business-analytics.policy';
import { ClientProgressPolicy } from './policies/client-progress.policy';

@Module({
  imports: [
    CheckinsModule,
    ClientsModule,
    ConsentsModule,
    MeasurementsModule,
    PaymentsModule,
    SubscriptionsModule,
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    ClientProgressOrchestrator,
    BusinessAnalyticsOrchestrator,
    ClientProgressPolicy,
    BusinessAnalyticsPolicy,
    // the dates rule is shared with subscriptions; it holds no state
    SubscriptionDatesPolicy,
  ],
})
export class AnalyticsModule {}
