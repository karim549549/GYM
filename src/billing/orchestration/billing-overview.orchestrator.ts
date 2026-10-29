import { Injectable } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import { TransactionManager } from '../../database/transaction.manager';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { BillingQueryHandler } from '../handlers/billing-query.handler';
import type { BillingOverview } from '../interfaces/billing.interface';
import { PlatformStatusPolicy } from '../policies/platform-status.policy';
import { BaseBillingOrchestrator } from './base-billing.orchestrator';

/**
 * Takes over `BillingService.overview`: the coach's plan, whether it is paid up, how many of its
 * places are used, and any invoice waiting to be paid.
 */
@Injectable()
export class BillingOverviewOrchestrator extends BaseBillingOrchestrator {
  constructor(
    billingQuery: BillingQueryHandler,
    transactions: TransactionManager,
    private readonly clients: ClientsService,
    private readonly dates: SubscriptionDatesPolicy,
    private readonly statusPolicy: PlatformStatusPolicy,
  ) {
    super(billingQuery, transactions);
  }

  execute(workspaceId: string): Promise<BillingOverview> {
    const today = this.dates.today(new Date());
    return this.transactions.run(
      async () => {
        const subscription = await this.subscriptionOf(workspaceId, today);
        const plan = await this.mustFindPlan(subscription.planId);
        const openInvoice =
          await this.billingQuery.findOpenInvoice(workspaceId);
        const activeClients = await this.clients.countActive(workspaceId);

        const free = plan.priceMinor === 0;
        return {
          plan,
          status: this.statusPolicy.statusOf({
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
            priceMinor: plan.priceMinor,
            today,
          }),
          currentPeriodStart: free ? null : subscription.currentPeriodStart,
          currentPeriodEnd: free ? null : subscription.currentPeriodEnd,
          usage: { clients: activeClients, limit: plan.clientLimit },
          openInvoice,
        };
      },
      { workspaceId },
    );
  }
}
