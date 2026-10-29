import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PaymentsService } from '../../payments/payments.service';
import { RemindersService } from '../../reminders/reminders.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import {
  SubscriptionClosedException,
  SubscriptionNotFoundException,
} from '../exceptions/subscription-exceptions';
import { SubscriptionsQueryHandler } from '../handlers/subscriptions-query.handler';
import type { SubscriptionRecord } from '../interfaces/subscription.interface';
import { SubscriptionDatesPolicy } from '../policies/subscription-dates.policy';
import { SubscriptionStatePolicy } from '../policies/subscription-state.policy';
import { BaseSubscriptionOrchestrator } from './base-subscription.orchestrator';

/**
 * Takes over `SubscriptionsService.cancel`. The subscription stays, with its payments, so the
 * history is whole; it just stops being the client's live one. A pause still open is closed
 * the same day, without giving the days back.
 */
@Injectable()
export class SubscriptionCancellationOrchestrator extends BaseSubscriptionOrchestrator {
  constructor(
    subscriptionsQuery: SubscriptionsQueryHandler,
    payments: PaymentsService,
    workspaces: WorkspacesService,
    dates: SubscriptionDatesPolicy,
    statePolicy: SubscriptionStatePolicy,
    transactions: TransactionManager,
    private readonly reminders: RemindersService,
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
        const found = await this.subscriptionsQuery.lockById(subscriptionId);
        if (!found) {
          throw new SubscriptionNotFoundException();
        }
        if (
          found.status === SubscriptionStatus.CANCELLED ||
          found.status === SubscriptionStatus.ENDED
        ) {
          throw new SubscriptionClosedException();
        }

        const freeze = await this.subscriptionsQuery.openFreeze(subscriptionId);
        if (freeze) {
          await this.subscriptionsQuery.closeFreeze(
            freeze.id,
            this.dates.today(new Date()),
          );
        }
        await this.subscriptionsQuery.setStatus(
          subscriptionId,
          SubscriptionStatus.CANCELLED,
        );
        await this.reminders.cancel(workspaceId, subscriptionId);
        return this.presentOne(workspaceId, {
          ...found,
          status: SubscriptionStatus.CANCELLED,
        });
      },
      { workspaceId },
    );
  }
}
