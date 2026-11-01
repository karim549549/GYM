import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import type { PaymentRecord } from '../../payments/interfaces/payment.interface';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import {
  PaymentRequestAlreadyConfirmedException,
  PaymentRequestNotFoundException,
  PaymentRequestNotReportedException,
} from '../exceptions/payment-request-exceptions';
import { PaymentRequestFileHandler } from '../handlers/payment-request-file.handler';
import { PaymentRequestsQueryHandler } from '../handlers/payment-requests-query.handler';
import type { PaymentRequestRecord } from '../interfaces/payment-request.interface';
import { PaymentRequestStatePolicy } from '../policies/payment-request-state.policy';
import { BasePaymentRequestOrchestrator } from './base-payment-request.orchestrator';

export interface PaymentRequestConfirmed {
  request: PaymentRequestRecord;
  payment: PaymentRecord;
}

/**
 * Takes over `PaymentRequestsService.confirm`: the coach accepts what the client reported (the amount that
 * was asked, the method they chose, the day they reported it, and their screenshot) and that records the
 * payment. One transaction: if the payment is refused (more than is owed) nothing is confirmed, and two
 * taps leave one payment. The screenshot is shared, not copied: both rows point at the same file.
 */
@Injectable()
export class PaymentRequestConfirmationOrchestrator extends BasePaymentRequestOrchestrator {
  private static readonly EGYPT = 'Africa/Cairo';

  constructor(
    paymentRequests: PaymentRequestsQueryHandler,
    statePolicy: PaymentRequestStatePolicy,
    transactions: TransactionManager,
    private readonly files: PaymentRequestFileHandler,
    private readonly subscriptions: SubscriptionsService,
  ) {
    super(paymentRequests, statePolicy, transactions);
  }

  async execute(
    workspaceId: string,
    recordedBy: string,
    requestId: string,
  ): Promise<PaymentRequestConfirmed> {
    const { request, payment } = await this.transactions.run(
      async () => {
        const found = await this.paymentRequests.findById(requestId);
        if (!found) {
          throw new PaymentRequestNotFoundException();
        }
        if (found.paymentId) {
          throw new PaymentRequestAlreadyConfirmedException();
        }
        if (!found.paidAt || !found.paidMethod) {
          throw new PaymentRequestNotReportedException();
        }

        const recorded = await this.subscriptions.receivePayment(
          workspaceId,
          recordedBy,
          found.subscriptionId,
          {
            amountMinor: found.amountMinor,
            method: found.paidMethod,
            paidOn: this.egyptDay(found.paidAt),
            note: found.note ?? undefined,
            receiptKey: found.receiptKey ?? undefined,
          },
        );
        if (!(await this.paymentRequests.markConfirmed(found.id, recorded.id))) {
          throw new PaymentRequestAlreadyConfirmedException();
        }
        return {
          request: { ...found, paymentId: recorded.id },
          payment: recorded,
        };
      },
      { workspaceId },
    );

    // signing is a call to the store, not the database: done once the transaction is closed
    const receiptUrl = await this.files.receiptUrlOf(request.receiptKey);
    return {
      request: { ...this.record(request), receiptUrl },
      payment: { ...payment, receiptUrl },
    };
  }

  /** The calendar day, in Egypt, as YYYY-MM-DD. */
  private egyptDay(moment: Date): string {
    return moment.toLocaleDateString('en-CA', {
      timeZone: PaymentRequestConfirmationOrchestrator.EGYPT,
    });
  }
}
