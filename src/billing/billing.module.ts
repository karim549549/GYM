import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { SubscriptionDatesPolicy } from '../subscriptions/policies/subscription-dates.policy';
import { AdminBillingController } from './admin-billing.controller';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PlatformAdminGuard } from './guards/platform-admin.guard';
import { BillingQueryHandler } from './handlers/billing-query.handler';
import { BillingOverviewOrchestrator } from './orchestration/billing-overview.orchestrator';
import { CollectionListOrchestrator } from './orchestration/collection-list.orchestrator';
import { InvoiceListOrchestrator } from './orchestration/invoice-list.orchestrator';
import { InvoicePaymentOrchestrator } from './orchestration/invoice-payment.orchestrator';
import { InvoiceVoidingOrchestrator } from './orchestration/invoice-voiding.orchestrator';
import { PlanChangeOrchestrator } from './orchestration/plan-change.orchestrator';
import { PlatformAdminCheckOrchestrator } from './orchestration/platform-admin-check.orchestrator';
import { PlatformPlanListOrchestrator } from './orchestration/platform-plan-list.orchestrator';
import { StartFreePlanOrchestrator } from './orchestration/start-free-plan.orchestrator';
import { BillingPeriodPolicy } from './policies/billing-period.policy';
import { PlanChangePolicy } from './policies/plan-change.policy';
import { PlatformStatusPolicy } from './policies/platform-status.policy';

@Module({
  imports: [ClientsModule],
  controllers: [BillingController, AdminBillingController],
  providers: [
    BillingService,
    BillingQueryHandler,
    PlatformPlanListOrchestrator,
    BillingOverviewOrchestrator,
    PlanChangeOrchestrator,
    InvoiceListOrchestrator,
    StartFreePlanOrchestrator,
    CollectionListOrchestrator,
    InvoicePaymentOrchestrator,
    InvoiceVoidingOrchestrator,
    PlatformAdminCheckOrchestrator,
    PlatformAdminGuard,
    BillingPeriodPolicy,
    PlanChangePolicy,
    PlatformStatusPolicy,
    // the dates rule is shared with subscriptions; it holds no state
    SubscriptionDatesPolicy,
  ],
  exports: [BillingService],
})
export class BillingModule {}
