import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PaymentsQueryHandler } from '../handlers/payments-query.handler';
import type {
  NewPayment,
  PaymentRecord,
} from '../interfaces/payment.interface';

/**
 * Takes over `PaymentsService.record`. It joins the transaction of the subscription flow that
 * calls it, which has already checked that the payment is allowed.
 */
@Injectable()
export class PaymentRecordingOrchestrator {
  constructor(
    private readonly paymentsQuery: PaymentsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(
    workspaceId: string,
    payment: NewPayment,
  ): Promise<PaymentRecord> {
    const created = await this.transactions.run(
      () => this.paymentsQuery.create(workspaceId, payment),
      { workspaceId },
    );
    return {
      id: created.id,
      subscriptionId: created.subscriptionId,
      clientId: created.clientId,
      amountMinor: created.amountMinor,
      currency: created.currency,
      method: created.method,
      paidOn: created.paidOn,
      note: created.note,
      createdAt: created.createdAt,
      receiptUrl: null,
    };
  }
}
