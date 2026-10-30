import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PaymentsService } from '../../payments/payments.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { SubscriptionsQueryHandler } from '../handlers/subscriptions-query.handler';
import type { LiveSubscription } from '../interfaces/subscription.interface';
import { SubscriptionDatesPolicy } from '../policies/subscription-dates.policy';
import { SubscriptionStatePolicy } from '../policies/subscription-state.policy';
import { BaseSubscriptionOrchestrator } from './base-subscription.orchestrator';

/** Takes over `SubscriptionsService.liveFor`: the running subscription of each client, with the days left. */
@Injectable()
export class SubscriptionLiveOrchestrator extends BaseSubscriptionOrchestrator {
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
    clientIds: string[],
  ): Promise<LiveSubscription[]> {
    return this.transactions.run(
      async () => {
        const rows = await this.subscriptionsQuery.findLiveByClientIds(clientIds);
        const today = this.dates.today(new Date());
        return (await this.present(workspaceId, rows)).map((record) => ({
          ...record,
          daysLeft: this.dates.daysBetween(today, record.endsOn),
        }));
      },
      { workspaceId },
    );
  }
}
