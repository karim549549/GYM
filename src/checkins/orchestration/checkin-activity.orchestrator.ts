import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { CheckinsQueryHandler } from '../handlers/checkins-query.handler';
import type { CheckinActivity } from '../interfaces/checkin.interface';

/**
 * Takes over `CheckinsService.activity`: the check-ins due in a window and what the client answered,
 * with when they last handed one in, for the progress page.
 */
@Injectable()
export class CheckinActivityOrchestrator {
  constructor(
    private readonly checkinsQuery: CheckinsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    workspaceId: string,
    clientId: string,
    from: string,
    to: string,
  ): Promise<{ window: CheckinActivity[]; lastSubmittedAt: Date | null }> {
    return this.transactions.run(
      async () => ({
        window: await this.checkinsQuery.activityBetween(clientId, from, to),
        lastSubmittedAt: await this.checkinsQuery.lastSubmittedAt(clientId),
      }),
      { workspaceId },
    );
  }
}
