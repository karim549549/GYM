import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import type { PaymentMethod } from '../../payments/enums/payment-method.enum';
import type { PaymentRecord } from '../../payments/interfaces/payment.interface';
import { PaymentsService } from '../../payments/payments.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import {
  PaymentExceedsDueException,
  SubscriptionClosedException,
  SubscriptionNotFoundException,
} from '../exceptions/subscription-exceptions';
import { SubscriptionsQueryHandler } from '../handlers/subscriptions-query.handler';
import { SubscriptionDatesPolicy } from '../policies/subscription-dates.policy';
import { SubscriptionStatePolicy } from '../policies/subscription-state.policy';
import { BaseSubscriptionOrchestrator } from './base-subscription.orchestrator';

export interface PaymentReceived {
  amountMinor: number;
  method: PaymentMethod;
  paidOn?: string;
  note?: string;
}

/**
 * Takes over `SubscriptionsService.receivePayment`. The subscription is locked while the amount is
 * checked against what is still owed, so two payments that together exceed the price cannot both
 * get in. A subscription that has expired can still be paid, for a client who pays late; one that
 * was cancelled cannot.
 */
@Injectable()
export class SubscriptionPaymentOrchestrator extends BaseSubscriptionOrchestrator {
  constructor(
    subscriptionsQuery: SubscriptionsQueryHandler,
    payments: PaymentsService,
    workspaces: WorkspacesService,
    dates: SubscriptionDatesPolicy,
    statePolicy: SubscriptionStatePolicy,
    transactions: TransactionManager,
  ) {
    super(
      subscriptionsQuery,
      payments,
      workspaces,
      dates,
      statePolicy,
      transactions,
    );
  }

  execute(
    workspaceId: string,
    recordedBy: string,
    subscriptionId: string,
    received: PaymentReceived,
  ): Promise<PaymentRecord> {
    return this.transactions.run(
      async () => {
        const found = await this.subscriptionsQuery.lockById(subscriptionId);
        if (!found) {
          throw new SubscriptionNotFoundException();
        }
        if (found.status === SubscriptionStatus.CANCELLED) {
          throw new SubscriptionClosedException();
        }

        const paid =
          (await this.payments.totalsFor(workspaceId, [subscriptionId])).get(
            subscriptionId,
          ) ?? 0;
        if (received.amountMinor > found.priceMinor - paid) {
          throw new PaymentExceedsDueException();
        }

        return this.payments.record(workspaceId, {
          subscriptionId,
          clientId: found.clientId,
          currency: found.currency,
          amountMinor: received.amountMinor,
          method: received.method,
          paidOn: received.paidOn ?? this.dates.today(new Date()),
          note: received.note,
          recordedBy,
        });
      },
      { workspaceId },
    );
  }
}
