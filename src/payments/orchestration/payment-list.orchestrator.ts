import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../../common/handlers/base-query.handler';
import { TransactionManager } from '../../database/transaction.manager';
import { PaymentFileHandler } from '../handlers/payment-file.handler';
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
    private readonly files: PaymentFileHandler,
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
    // signing is a call to the store, not the database: done once the transaction is closed
    const items = await Promise.all(
      result.items.map(async ({ receiptKey, ...payment }) => ({
        ...payment,
        receiptUrl: await this.files.receiptUrlOf(receiptKey),
      })),
    );
    return { ...result, items };
  }
}
