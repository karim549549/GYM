import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../../common/handlers/base-query.handler';
import { TransactionManager } from '../../database/transaction.manager';
import { PaymentRequestFileHandler } from '../handlers/payment-request-file.handler';
import { PaymentRequestsQueryHandler } from '../handlers/payment-requests-query.handler';
import type { PaymentRequestRecord } from '../interfaces/payment-request.interface';
import { PaymentRequestStatePolicy } from '../policies/payment-request-state.policy';
import { BasePaymentRequestOrchestrator } from './base-payment-request.orchestrator';

/** Takes over `PaymentRequestsService.list`: the coach's payment links, newest first. */
@Injectable()
export class PaymentRequestListOrchestrator extends BasePaymentRequestOrchestrator {
  constructor(
    paymentRequests: PaymentRequestsQueryHandler,
    statePolicy: PaymentRequestStatePolicy,
    transactions: TransactionManager,
    private readonly files: PaymentRequestFileHandler,
  ) {
    super(paymentRequests, statePolicy, transactions);
  }

  async execute(
    workspaceId: string,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<PaymentRequestRecord>> {
    const found = await this.transactions.run(
      () => this.paymentRequests.list(page, limit),
      { workspaceId },
    );
    // signing is a call to the store, not the database: done once the transaction is closed
    const items = await Promise.all(
      found.items.map(async (request) => ({
        ...this.record(request),
        receiptUrl: await this.files.receiptUrlOf(request.receiptKey),
      })),
    );
    return { ...found, items };
  }
}
