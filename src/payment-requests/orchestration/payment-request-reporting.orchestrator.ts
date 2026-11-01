import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import type { PaymentMethod } from '../../payments/enums/payment-method.enum';
import {
  PaymentRequestAlreadyPaidException,
  PaymentRequestExpiredException,
} from '../exceptions/payment-request-exceptions';
import { PaymentRequestFileHandler } from '../handlers/payment-request-file.handler';
import { PaymentRequestsQueryHandler } from '../handlers/payment-requests-query.handler';
import { PaymentRequestStatePolicy } from '../policies/payment-request-state.policy';
import { BasePaymentRequestOrchestrator } from './base-payment-request.orchestrator';

/**
 * Takes over `PaymentRequestsService.report`: the client says they paid and sends the transfer screenshot.
 * This is their word, not money received: no `payments` row is made, the coach records the payment once
 * they have seen it arrive. The claim is atomic and only while the link is open, so two reports at once
 * leave one winner; the loser's screenshot is deleted again.
 */
@Injectable()
export class PaymentRequestReportingOrchestrator extends BasePaymentRequestOrchestrator {
  constructor(
    paymentRequests: PaymentRequestsQueryHandler,
    statePolicy: PaymentRequestStatePolicy,
    transactions: TransactionManager,
    private readonly files: PaymentRequestFileHandler,
  ) {
    super(paymentRequests, statePolicy, transactions);
  }

  async execute(
    token: string,
    method: PaymentMethod,
    receipt: Uint8Array,
  ): Promise<void> {
    const request = await this.openRequest(token);
    this.refuseUnlessOpen(request);

    const receiptKey = await this.files.saveReceipt(
      request.workspaceId,
      receipt,
    );
    // the token scope only reads: the write runs in the link's workspace
    const claimed = await this.transactions.run(
      () => this.paymentRequests.markPaid(request.id, method, receiptKey),
      { workspaceId: request.workspaceId },
    );
    if (!claimed) {
      await this.files.removeReceipt(receiptKey);
      // someone else got there first, or the date passed in between
      this.refuseUnlessOpen(await this.openRequest(token));
    }
  }

  private refuseUnlessOpen(request: {
    paidAt: Date | null;
    expiresAt: Date;
  }): void {
    const state = this.statePolicy.of(request, new Date());
    if (state === 'paid') {
      throw new PaymentRequestAlreadyPaidException();
    }
    if (state === 'expired') {
      throw new PaymentRequestExpiredException();
    }
  }
}
