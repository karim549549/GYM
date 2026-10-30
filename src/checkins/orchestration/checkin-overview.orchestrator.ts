import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { CheckinsQueryHandler } from '../handlers/checkins-query.handler';
import type { ClientCheckinDays } from '../interfaces/checkin.interface';

/**
 * Takes over `CheckinsService.overviewFor`: for each client, the days to the next check-in and the
 * ones missed in the last thirty days, which is what the clients list shows.
 */
@Injectable()
export class CheckinOverviewOrchestrator {
  private static readonly WINDOW_DAYS = 30;

  constructor(
    private readonly checkinsQuery: CheckinsQueryHandler,
    private readonly dates: SubscriptionDatesPolicy,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    workspaceId: string,
    clientIds: string[],
  ): Promise<ClientCheckinDays[]> {
    const today = this.dates.today(new Date());
    return this.transactions.run(
      async () => {
        const rows = await this.checkinsQuery.overviewFor(
          clientIds,
          today,
          this.dates.addDays(today, -CheckinOverviewOrchestrator.WINDOW_DAYS),
        );
        return rows.map((row) => ({
          clientId: row.clientId,
          nextInDays: row.nextDueOn
            ? this.dates.daysBetween(today, row.nextDueOn)
            : null,
          missedCount: row.missedCount,
        }));
      },
      { workspaceId },
    );
  }
}
