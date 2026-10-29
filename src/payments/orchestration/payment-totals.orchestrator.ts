import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PaymentsQueryHandler } from '../handlers/payments-query.handler';

/** Takes over `PaymentsService.totalsFor`: how much each subscription has received, for its balance. */
@Injectable()
export class PaymentTotalsOrchestrator {
  constructor(
    private readonly paymentsQuery: PaymentsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    workspaceId: string,
    subscriptionIds: string[],
  ): Promise<Map<string, number>> {
    return this.transactions.run(
      () => this.paymentsQuery.totalsBySubscription(subscriptionIds),
      { workspaceId },
    );
  }
}
