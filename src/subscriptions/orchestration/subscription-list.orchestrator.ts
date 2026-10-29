import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../../common/handlers/base-query.handler';
import { TransactionManager } from '../../database/transaction.manager';
import { PaymentsService } from '../../payments/payments.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { SubscriptionsQueryHandler } from '../handlers/subscriptions-query.handler';
import type {
  StoredSubscriptionFilter,
  SubscriptionListFilter,
  SubscriptionRecord,
} from '../interfaces/subscription.interface';
import { SubscriptionDatesPolicy } from '../policies/subscription-dates.policy';
import { SubscriptionStatePolicy } from '../policies/subscription-state.policy';
import { BaseSubscriptionOrchestrator } from './base-subscription.orchestrator';

/** Takes over `SubscriptionsService.list`: a page of subscriptions, newest start first. */
@Injectable()
export class SubscriptionListOrchestrator extends BaseSubscriptionOrchestrator {
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
    filter: SubscriptionListFilter,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<SubscriptionRecord>> {
    return this.transactions.run(
      async () => {
        const result = await this.subscriptionsQuery.list(
          this.stored(filter),
          page,
          limit,
        );
        return {
          ...result,
          items: await this.present(workspaceId, result.items),
        };
      },
      { workspaceId },
    );
  }

  /** "Ending within N days" means a running subscription whose last day is between today and then. */
  private stored(filter: SubscriptionListFilter): StoredSubscriptionFilter {
    const { endsWithinDays, ...rest } = filter;
    if (endsWithinDays === undefined) {
      return rest;
    }
    const today = this.dates.today(new Date());
    return {
      ...rest,
      status: rest.status ?? SubscriptionStatus.ACTIVE,
      endsFrom: today,
      endsTo: this.dates.addDays(today, endsWithinDays),
    };
  }
}
