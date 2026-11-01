import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PaymentNotFoundException } from '../exceptions/payment-exceptions';
import { PaymentFileHandler } from '../handlers/payment-file.handler';
import { PaymentsQueryHandler } from '../handlers/payments-query.handler';
import type { PaymentRecord } from '../interfaces/payment.interface';

/**
 * Takes over `PaymentsService.setReceipt`: the transfer screenshot of a payment the coach recorded. It is
 * optional and can be added or replaced later. The old file is deleted only after the new key is saved.
 */
@Injectable()
export class PaymentReceiptOrchestrator {
  constructor(
    private readonly paymentsQuery: PaymentsQueryHandler,
    private readonly files: PaymentFileHandler,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(
    workspaceId: string,
    paymentId: string,
    bytes: Uint8Array,
  ): Promise<PaymentRecord> {
    const previous = await this.transactions.run(
      () => this.paymentsQuery.findById(paymentId),
      { workspaceId },
    );
    if (!previous) {
      throw new PaymentNotFoundException();
    }

    const receiptKey = await this.files.saveReceipt(workspaceId, bytes);
    await this.transactions.run(
      () => this.paymentsQuery.setReceiptKey(paymentId, receiptKey),
      { workspaceId },
    );
    if (previous.receiptKey) {
      await this.files.removeReceipt(previous.receiptKey);
    }

    return {
      id: previous.id,
      subscriptionId: previous.subscriptionId,
      clientId: previous.clientId,
      amountMinor: previous.amountMinor,
      currency: previous.currency,
      method: previous.method,
      paidOn: previous.paidOn,
      note: previous.note,
      createdAt: previous.createdAt,
      receiptUrl: await this.files.receiptUrlOf(receiptKey),
    };
  }
}
