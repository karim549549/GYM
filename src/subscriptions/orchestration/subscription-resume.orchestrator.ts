import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PaymentsService } from '../../payments/payments.service';
import { RemindersService } from '../../reminders/reminders.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import {
  ResumeBeforeFreezeException,
  SubscriptionNotFoundException,
  SubscriptionNotFrozenException,
} from '../exceptions/subscription-exceptions';
import { SubscriptionsQueryHandler } from '../handlers/subscriptions-query.handler';
import type { SubscriptionRecord } from '../interfaces/subscription.interface';
import { SubscriptionDatesPolicy } from '../policies/subscription-dates.policy';
import { SubscriptionFreezePolicy } from '../policies/subscription-freeze.policy';
import { SubscriptionStatePolicy } from '../policies/subscription-state.policy';
import { BaseSubscriptionOrchestrator } from './base-subscription.orchestrator';

/** Takes over `SubscriptionsService.resume`: the days spent frozen are added back to the end date. */
@Injectable()
export class SubscriptionResumeOrchestrator extends BaseSubscriptionOrchestrator {
  constructor(
    subscriptionsQuery: SubscriptionsQueryHandler,
    payments: PaymentsService,
    workspaces: WorkspacesService,
    dates: SubscriptionDatesPolicy,
    statePolicy: SubscriptionStatePolicy,
    transactions: TransactionManager,
    private readonly freezePolicy: SubscriptionFreezePolicy,
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
    resumedOn?: string,
  ): Promise<SubscriptionRecord> {
    return this.transactions.run(
      async () => {
        const found = await this.subscriptionsQuery.lockById(subscriptionId);
        if (!found) {
          throw new SubscriptionNotFoundException();
        }
        const freeze = await this.subscriptionsQuery.openFreeze(subscriptionId);
        if (found.status !== SubscriptionStatus.FROZEN || !freeze) {
          throw new SubscriptionNotFrozenException();
        }

        const decision = this.freezePolicy.resume({
          frozenOn: freeze.frozenOn,
          resumedOn: resumedOn ?? this.dates.today(new Date()),
          endsOn: found.endsOn,
        });
        if (decision.outcome === 'before_freeze') {
          throw new ResumeBeforeFreezeException();
        }

        await this.subscriptionsQuery.closeFreeze(
          freeze.id,
          resumedOn ?? this.dates.today(new Date()),
        );
        await this.subscriptionsQuery.resume(subscriptionId, decision.endsOn);
        await this.reminders.schedule(workspaceId, {
          clientId: found.clientId,
          subscriptionId,
          endsOn: decision.endsOn,
        });
        return this.presentOne(workspaceId, {
          ...found,
          status: SubscriptionStatus.ACTIVE,
          endsOn: decision.endsOn,
        });
      },
      { workspaceId },
    );
  }
}
