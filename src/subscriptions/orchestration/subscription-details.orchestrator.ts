import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PaymentsService } from '../../payments/payments.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { SubscriptionNotFoundException } from '../exceptions/subscription-exceptions';
import { SubscriptionsQueryHandler } from '../handlers/subscriptions-query.handler';
import type { SubscriptionRecord } from '../interfaces/subscription.interface';
import { SubscriptionDatesPolicy } from '../policies/subscription-dates.policy';
import { SubscriptionStatePolicy } from '../policies/subscription-state.policy';
import { BaseSubscriptionOrchestrator } from './base-subscription.orchestrator';

/** Takes over `SubscriptionsService.findOne`. */
@Injectable()
export class SubscriptionDetailsOrchestrator extends BaseSubscriptionOrchestrator {
  constructor(
    subscriptionsQuery: SubscriptionsQueryHandler,
    payments: PaymentsService,
    workspaces: WorkspacesService,
    dates: SubscriptionDatesPolicy,
    statePolicy: SubscriptionStatePolicy,
    transactions: TransactionManager,
  ) {
    super(
      subscriptionsQuery,
      payments,
      workspaces,
      dates,
      statePolicy,
      transactions,
    );
  }

  execute(
    workspaceId: string,
    subscriptionId: string,
  ): Promise<SubscriptionRecord> {
    return this.transactions.run(
      async () => {
        const found = await this.subscriptionsQuery.findById(subscriptionId);
        if (!found) {
          throw new SubscriptionNotFoundException();
        }
        return this.presentOne(workspaceId, found);
      },
      { workspaceId },
    );
  }
}
