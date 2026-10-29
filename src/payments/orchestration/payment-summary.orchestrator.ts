import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PaymentsQueryHandler } from '../handlers/payments-query.handler';
import type { PaymentSummary } from '../interfaces/payment.interface';

/** Takes over `PaymentsService.summary`: what was received between two days, both included. */
@Injectable()
export class PaymentSummaryOrchestrator {
  constructor(
    private readonly paymentsQuery: PaymentsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    workspaceId: string,
    from: string,
    to: string,
  ): Promise<PaymentSummary> {
    return this.transactions.run(() => this.paymentsQuery.summary(from, to), {
      workspaceId,
    });
  }
}
