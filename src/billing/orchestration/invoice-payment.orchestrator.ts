import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { PlatformSubscriptionStatus } from '../enums/platform-subscription-status.enum';
import {
  InvoiceNotFoundException,
  InvoiceNotOpenException,
} from '../exceptions/billing-exceptions';
import { BillingQueryHandler } from '../handlers/billing-query.handler';
import type {
  CollectionInvoiceRecord,
  InvoicePayment,
} from '../interfaces/billing.interface';
import { BillingPeriodPolicy } from '../policies/billing-period.policy';
import { BaseBillingOrchestrator } from './base-billing.orchestrator';

/**
 * Takes over `BillingService.markInvoicePaid`: a person at the platform has seen the transfer. The
 * invoice is taken if it is still open (of two people confirming one transfer, one wins), and the
 * coach moves onto the plan it buys for the period it pays. Paying the plan they are already on
 * before it ends continues it from the day after, losing no days; moving to another plan starts it
 * today, with no credit carried over. Acts as the system: the coach's own row is in another workspace.
 */
@Injectable()
export class InvoicePaymentOrchestrator extends BaseBillingOrchestrator {
  constructor(
    billingQuery: BillingQueryHandler,
    transactions: TransactionManager,
    private readonly dates: SubscriptionDatesPolicy,
    private readonly periodPolicy: BillingPeriodPolicy,
  ) {
    super(billingQuery, transactions);
  }

  execute(
    invoiceId: string,
    markedBy: string,
    payment: InvoicePayment,
  ): Promise<CollectionInvoiceRecord> {
    const today = payment.paidOn ?? this.dates.today(new Date());
    return this.transactions.run(
      async () => {
        const invoice = await this.billingQuery.findInvoice(invoiceId);
        if (!invoice) {
          throw new InvoiceNotFoundException();
        }
        const plan = await this.mustFindPlan(invoice.planId);
        const subscription = await this.billingQuery.lockSubscription(
          invoice.workspaceId,
        );

        const continuing =
          subscription?.planId === plan.id &&
          subscription.status === PlatformSubscriptionStatus.ACTIVE;
        const period = this.periodPolicy.nextPeriod({
          today,
          interval: plan.interval,
          runningUntil: continuing ? subscription.currentPeriodEnd : null,
        });

        const taken = await this.billingQuery.markPaid(invoiceId, {
          method: payment.method,
          paidAt: new Date(`${today}T12:00:00Z`),
          markedBy,
          period,
        });
        if (!taken) {
          throw new InvoiceNotOpenException();
        }

        const bought = {
          planId: plan.id,
          status: PlatformSubscriptionStatus.ACTIVE,
          currentPeriodStart: period.start,
          currentPeriodEnd: period.end,
          cancelAtPeriodEnd: false,
        };
        if (subscription) {
          await this.billingQuery.updateSubscription(
            invoice.workspaceId,
            bought,
          );
        } else {
          await this.billingQuery.insertSubscription(
            invoice.workspaceId,
            bought,
          );
        }
        return (await this.billingQuery.findInvoice(
          invoiceId,
        )) as CollectionInvoiceRecord;
      },
      { system: true },
    );
  }
}
