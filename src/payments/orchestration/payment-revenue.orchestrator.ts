import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PaymentsQueryHandler } from '../handlers/payments-query.handler';

/** Takes over `PaymentsService.revenueByMonth`: what came in each month, and from how many clients. */
@Injectable()
export class PaymentRevenueOrchestrator {
  constructor(
    private readonly paymentsQuery: PaymentsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    workspaceId: string,
    from: string,
    to: string,
  ): Promise<{
    months: { month: string; totalMinor: number }[];
    payers: number;
  }> {
    return this.transactions.run(
      () => this.paymentsQuery.revenueByMonth(from, to),
      { workspaceId },
    );
  }
}
