import { Injectable } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import { TransactionManager } from '../../database/transaction.manager';
import { SubscriptionStatus } from '../../subscriptions/enums/subscription-status.enum';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import {
  PaymentRequestExceedsDueException,
  PaymentRequestSubscriptionClosedException,
} from '../exceptions/payment-request-exceptions';
import { PaymentRequestsQueryHandler } from '../handlers/payment-requests-query.handler';
import type { PaymentRequestRecord } from '../interfaces/payment-request.interface';
import { PaymentRequestStatePolicy } from '../policies/payment-request-state.policy';
import { BasePaymentRequestOrchestrator } from './base-payment-request.orchestrator';

export interface PaymentRequestAsked {
  subscriptionId: string;
  amountMinor: number;
  note?: string;
}

/**
 * Takes over `PaymentRequestsService.create`: a payment link for a subscription. It cannot ask for more
 * than is still owed, nor for a cancelled subscription. The client's name and the package are copied onto
 * the request, so the public page needs nothing else.
 */
@Injectable()
export class PaymentRequestCreationOrchestrator extends BasePaymentRequestOrchestrator {
  constructor(
    paymentRequests: PaymentRequestsQueryHandler,
    statePolicy: PaymentRequestStatePolicy,
    transactions: TransactionManager,
    private readonly subscriptions: SubscriptionsService,
    private readonly clients: ClientsService,
  ) {
    super(paymentRequests, statePolicy, transactions);
  }

  execute(
    workspaceId: string,
    createdBy: string,
    asked: PaymentRequestAsked,
  ): Promise<PaymentRequestRecord> {
    return this.transactions.run(
      async () => {
        const subscription = await this.subscriptions.findOne(
          workspaceId,
          asked.subscriptionId,
        );
        if (subscription.status === SubscriptionStatus.CANCELLED) {
          throw new PaymentRequestSubscriptionClosedException();
        }
        if (asked.amountMinor > subscription.dueMinor) {
          throw new PaymentRequestExceedsDueException();
        }
        const client = await this.clients.findOne(
          workspaceId,
          subscription.clientId,
        );

        const created = await this.withFreeToken((token) =>
          this.paymentRequests.create(workspaceId, {
            subscriptionId: subscription.id,
            clientId: subscription.clientId,
            token,
            clientName: client.fullName,
            packageName: subscription.packageName,
            amountMinor: asked.amountMinor,
            currency: subscription.currency,
            note: asked.note,
            expiresAt: this.statePolicy.expiryFrom(new Date()),
            createdBy,
          }),
        );
        return this.record(created);
      },
      { workspaceId },
    );
  }
}
