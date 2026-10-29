import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { BillingQueryHandler } from '../handlers/billing-query.handler';
import { BaseBillingOrchestrator } from './base-billing.orchestrator';

/**
 * Takes over `BillingService.startFreePlan`. It runs inside the transaction that has just created the
 * workspace, whose scope the database already set, so it asks for no scope of its own (that would be
 * refused). Outside such a transaction there is no scope and row level security blocks the insert:
 * it fails closed.
 */
@Injectable()
export class StartFreePlanOrchestrator extends BaseBillingOrchestrator {
  constructor(
    billingQuery: BillingQueryHandler,
    transactions: TransactionManager,
    private readonly dates: SubscriptionDatesPolicy,
  ) {
    super(billingQuery, transactions);
  }

  execute(workspaceId: string): Promise<void> {
    return this.transactions.run(() =>
      this.billingQuery.insertSubscription(
        workspaceId,
        this.freePlan(this.dates.today(new Date())),
      ),
    );
  }
}
