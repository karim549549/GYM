import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PaymentsService } from '../../payments/payments.service';
import { RemindersService } from '../../reminders/reminders.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import {
  SubscriptionNotActiveException,
  SubscriptionNotFoundException,
} from '../exceptions/subscription-exceptions';
import { SubscriptionsQueryHandler } from '../handlers/subscriptions-query.handler';
import type { SubscriptionRecord } from '../interfaces/subscription.interface';
import { SubscriptionDatesPolicy } from '../policies/subscription-dates.policy';
import { SubscriptionStatePolicy } from '../policies/subscription-state.policy';
import { BaseSubscriptionOrchestrator } from './base-subscription.orchestrator';

/** Takes over `SubscriptionsService.freeze`: travel, exams or Ramadan, the clock stops. */
@Injectable()
export class SubscriptionFreezeOrchestrator extends BaseSubscriptionOrchestrator {
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
    freeze: { frozenOn?: string; reason?: string },
  ): Promise<SubscriptionRecord> {
    return this.transactions.run(
      async () => {
        const found = await this.subscriptionsQuery.lockById(subscriptionId);
        if (!found) {
          throw new SubscriptionNotFoundException();
        }
        if (found.status !== SubscriptionStatus.ACTIVE) {
          throw new SubscriptionNotActiveException();
        }

        await this.subscriptionsQuery.createFreeze(
          workspaceId,
          subscriptionId,
          freeze.frozenOn ?? this.dates.today(new Date()),
          freeze.reason ?? null,
        );
        await this.subscriptionsQuery.setStatus(
          subscriptionId,
          SubscriptionStatus.FROZEN,
        );
        await this.reminders.cancel(workspaceId, subscriptionId);
        return this.presentOne(workspaceId, {
          ...found,
          status: SubscriptionStatus.FROZEN,
        });
      },
      { workspaceId },
    );
  }
}
