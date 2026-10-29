import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { SubscriptionsQueryHandler } from '../handlers/subscriptions-query.handler';
import type { SubscriptionStatistics } from '../interfaces/subscription.interface';

/**
 * Takes over `SubscriptionsService.statistics`: what the coach's business analytics reads from the
 * subscriptions. A renewal is another subscription beginning within two weeks of the end.
 */
@Injectable()
export class SubscriptionStatisticsOrchestrator {
  private static readonly RENEWAL_GRACE_DAYS = 14;

  constructor(
    private readonly subscriptionsQuery: SubscriptionsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    workspaceId: string,
    input: {
      coveredOn: string[];
      endedFrom: string;
      endedTo: string;
      today: string;
    },
  ): Promise<SubscriptionStatistics> {
    return this.transactions.run(
      async () => ({
        coveredOn: await this.coveredOn(input.coveredOn),
        renewals: await this.subscriptionsQuery.renewalStats(
          input.endedFrom,
          input.endedTo,
          SubscriptionStatisticsOrchestrator.RENEWAL_GRACE_DAYS,
        ),
        lifetime: await this.subscriptionsQuery.lifetimeStats(input.today),
      }),
      { workspaceId },
    );
  }
  /** One after the other: they share the open transaction's single connection. */
  private async coveredOn(
    days: string[],
  ): Promise<{ day: string; clients: number }[]> {
    const counted: { day: string; clients: number }[] = [];
    for (const day of days) {
      counted.push({
        day,
        clients: await this.subscriptionsQuery.countClientsCoveredOn(day),
      });
    }
    return counted;
  }
}
