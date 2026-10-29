import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../../common/handlers/base-query.handler';
import { TransactionManager } from '../../database/transaction.manager';
import { PaymentsQueryHandler } from '../handlers/payments-query.handler';
import type {
  PaymentListFilter,
  PaymentRecord,
} from '../interfaces/payment.interface';

/** Takes over `PaymentsService.list`: a page of the workspace's payments, newest first. */
@Injectable()
export class PaymentListOrchestrator {
  constructor(
    private readonly paymentsQuery: PaymentsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(
    workspaceId: string,
    filter: PaymentListFilter,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<PaymentRecord>> {
    const result = await this.transactions.run(
      () => this.paymentsQuery.list(filter, page, limit),
      { workspaceId },
    );
    return {
      ...result,
      items: result.items.map((payment) => ({ ...payment, receiptUrl: null })),
    };
  }
}
