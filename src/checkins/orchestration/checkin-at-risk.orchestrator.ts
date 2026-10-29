import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../../common/handlers/base-query.handler';
import { TransactionManager } from '../../database/transaction.manager';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { CheckinsQueryHandler } from '../handlers/checkins-query.handler';
import type { QuietClient } from '../interfaces/checkin.interface';

/**
 * Takes over `CheckinsService.atRisk`: the clients who went quiet, meaning two or more check-ins
 * missed in the last thirty days. The coach calls them before they leave, not after.
 */
@Injectable()
export class CheckinAtRiskOrchestrator {
  private static readonly WINDOW_DAYS = 30;

  constructor(
    private readonly checkinsQuery: CheckinsQueryHandler,
    private readonly dates: SubscriptionDatesPolicy,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    workspaceId: string,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<QuietClient>> {
    const today = this.dates.today(new Date());
    return this.transactions.run(
      () =>
        this.checkinsQuery.atRisk(
          today,
          this.dates.addDays(today, -CheckinAtRiskOrchestrator.WINDOW_DAYS),
          page,
          limit,
        ),
      { workspaceId },
    );
  }
}
