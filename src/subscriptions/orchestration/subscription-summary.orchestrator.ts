import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { SubscriptionsQueryHandler } from '../handlers/subscriptions-query.handler';
import type { SubscriptionSummary } from '../interfaces/subscription.interface';
import { SubscriptionDatesPolicy } from '../policies/subscription-dates.policy';

/** Takes over `SubscriptionsService.summary`: the subscription figures of the coach's home screen. */
@Injectable()
export class SubscriptionSummaryOrchestrator {
  private static readonly WEEK_DAYS = 7;

  constructor(
    private readonly subscriptionsQuery: SubscriptionsQueryHandler,
    private readonly dates: SubscriptionDatesPolicy,
    private readonly transactions: TransactionManager,
  ) {}

  execute(workspaceId: string): Promise<SubscriptionSummary> {
    const today = this.dates.today(new Date());
    return this.transactions.run(
      async () => ({
        activeClients: await this.subscriptionsQuery.countActiveClients(today),
        renewalsDueThisWeek: await this.subscriptionsQuery.countEndingBetween(
          today,
          this.dates.addDays(today, SubscriptionSummaryOrchestrator.WEEK_DAYS),
        ),
        month: this.dates.monthOf(today),
      }),
      { workspaceId },
    );
  }
}
