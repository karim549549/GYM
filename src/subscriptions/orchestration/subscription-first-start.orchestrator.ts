import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { SubscriptionsQueryHandler } from '../handlers/subscriptions-query.handler';

/** Takes over `SubscriptionsService.firstStart`: the day a client's first subscription began. */
@Injectable()
export class SubscriptionFirstStartOrchestrator {
  constructor(
    private readonly subscriptionsQuery: SubscriptionsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(workspaceId: string, clientId: string): Promise<string | null> {
    return this.transactions.run(
      () => this.subscriptionsQuery.firstStart(clientId),
      { workspaceId },
    );
  }
}
