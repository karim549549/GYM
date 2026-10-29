import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PaymentsService } from '../../payments/payments.service';
import { RemindersService } from '../../reminders/reminders.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import {
  EndBeforeStartException,
  SubscriptionClosedException,
  SubscriptionNotFoundException,
} from '../exceptions/subscription-exceptions';
import { SubscriptionsQueryHandler } from '../handlers/subscriptions-query.handler';
import type { SubscriptionRecord } from '../interfaces/subscription.interface';
import { SubscriptionDatesPolicy } from '../policies/subscription-dates.policy';
import { SubscriptionStatePolicy } from '../policies/subscription-state.policy';
import { BaseSubscriptionOrchestrator } from './base-subscription.orchestrator';

/** Takes over `SubscriptionsService.changeEnd`: the coach moves the end date by hand. */
@Injectable()
export class SubscriptionUpdateOrchestrator extends BaseSubscriptionOrchestrator {
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
    endsOn: string,
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
        if (this.dates.daysBetween(found.startsOn, endsOn) < 0) {
          throw new EndBeforeStartException();
        }

        await this.subscriptionsQuery.setEndsOn(subscriptionId, endsOn);
        // a paused subscription has nothing to announce until it resumes
        if (found.status === SubscriptionStatus.ACTIVE) {
          await this.reminders.schedule(workspaceId, {
            clientId: found.clientId,
            subscriptionId,
            endsOn,
          });
        }
        return this.presentOne(workspaceId, { ...found, endsOn });
      },
      { workspaceId },
    );
  }
}
