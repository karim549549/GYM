import { Injectable } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import { TransactionManager } from '../../database/transaction.manager';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import {
  AlreadyOnFreePlanException,
  PlanLimitBelowClientsException,
} from '../exceptions/billing-exceptions';
import { BillingQueryHandler } from '../handlers/billing-query.handler';
import { BillingPeriodPolicy } from '../policies/billing-period.policy';
import { PlanChangePolicy } from '../policies/plan-change.policy';
import { BaseBillingOrchestrator } from './base-billing.orchestrator';

/**
 * Takes over `BillingService.changePlan`. Asking for a paid plan makes an invoice for the coach to pay
 * by transfer (asking again for the same plan returns the one already waiting); nothing changes until
 * a person at the platform confirms the money arrived. The free plan costs nothing so it takes effect
 * at once, and cancels whatever was waiting to be paid. A plan with fewer places than the coach has
 * clients is refused.
 */
@Injectable()
export class PlanChangeOrchestrator extends BaseBillingOrchestrator {
  constructor(
    billingQuery: BillingQueryHandler,
    transactions: TransactionManager,
    private readonly clients: ClientsService,
    private readonly dates: SubscriptionDatesPolicy,
    private readonly periodPolicy: BillingPeriodPolicy,
    private readonly changePolicy: PlanChangePolicy,
  ) {
    super(billingQuery, transactions);
  }

  /** Done when it has taken effect or an invoice is waiting; the caller reads the overview to show it. */
  execute(workspaceId: string, planId: string): Promise<void> {
    const today = this.dates.today(new Date());
    return this.transactions.run(
      async () => {
        const target = await this.mustFindPlan(planId);
        const subscription = await this.subscriptionOf(workspaceId, today);
        const current = await this.mustFindPlan(subscription.planId);

        const decision = this.changePolicy.decide({
          current,
          target,
          activeClients: await this.clients.countActive(workspaceId),
        });
        switch (decision.outcome) {
          case 'limit_below_clients':
            throw new PlanLimitBelowClientsException();
          case 'already_free':
            throw new AlreadyOnFreePlanException();
          case 'free_now':
            await this.billingQuery.voidOpenInvoices(workspaceId);
            await this.billingQuery.updateSubscription(workspaceId, {
              ...this.freePlan(today),
              cancelAtPeriodEnd: false,
            });
            return;
          case 'invoice':
            if (await this.billingQuery.findOpenInvoice(workspaceId, planId)) {
              return;
            }
            await this.billingQuery.createInvoice(workspaceId, {
              planId,
              amountMinor: target.priceMinor,
              currency: target.currency,
              // provisional: the period actually bought is set when the money is confirmed
              period: this.periodPolicy.periodFrom(today, target.interval),
            });
        }
      },
      { workspaceId },
    );
  }
}
