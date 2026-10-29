import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../../common/handlers/base-query.handler';
import { TransactionManager } from '../../database/transaction.manager';
import { SubscriptionNotFoundException } from '../exceptions/subscription-exceptions';
import { SubscriptionsQueryHandler } from '../handlers/subscriptions-query.handler';
import type { FreezeRecord } from '../interfaces/subscription.interface';

/** Takes over `SubscriptionsService.freezes`: every pause, so a moved end date can be explained. */
@Injectable()
export class SubscriptionFreezeListOrchestrator {
  constructor(
    private readonly subscriptionsQuery: SubscriptionsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    workspaceId: string,
    subscriptionId: string,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<FreezeRecord>> {
    return this.transactions.run(
      async () => {
        if (!(await this.subscriptionsQuery.findById(subscriptionId))) {
          throw new SubscriptionNotFoundException();
        }
        return this.subscriptionsQuery.listFreezes(subscriptionId, page, limit);
      },
      { workspaceId },
    );
  }
}
