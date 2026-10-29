import type { BillingInterval } from '../enums/billing-interval.enum';
import type { InvoicePaymentMethod } from '../enums/invoice-payment-method.enum';
import type { InvoiceStatus } from '../enums/invoice-status.enum';
import type { PlatformSubscriptionStatus } from '../enums/platform-subscription-status.enum';

export interface PlatformPlanRecord {
  id: string;
  name: string;
  /** In minor units (piastres). */
  priceMinor: number;
  currency: string;
  /** Null is unlimited. */
  clientLimit: number | null;
  interval: BillingInterval;
}

export interface StoredPlatformSubscription {
  planId: string;
  status: PlatformSubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

export interface InvoiceRecord {
  id: string;
  planId: string;
  amountMinor: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  status: InvoiceStatus;
  method: InvoicePaymentMethod | null;
  paidAt: Date | null;
  createdAt: Date;
}

/** An invoice as the platform's own people see it: whose it is as well. */
export interface CollectionInvoiceRecord extends InvoiceRecord {
  workspaceId: string;
}

export interface BillingOverview {
  plan: PlatformPlanRecord;
  /** Past due is worked out from the period's end. A free plan never is. */
  status: PlatformSubscriptionStatus;
  /** Null for a free plan, which has no period to run out. */
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  usage: { clients: number; limit: number | null };
  /** What is waiting to be paid, if anything. */
  openInvoice: InvoiceRecord | null;
}

export interface InvoicePayment {
  method: InvoicePaymentMethod;
  /** The day the money arrived; defaults to today. */
  paidOn?: string;
}

export interface BillingPeriod {
  start: string;
  end: string;
}
