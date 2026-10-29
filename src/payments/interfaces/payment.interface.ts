import type { PaymentMethod } from '../enums/payment-method.enum';

export interface PaymentRecord {
  id: string;
  subscriptionId: string;
  clientId: string;
  /** In minor units (piastres). */
  amountMinor: number;
  currency: string;
  method: PaymentMethod;
  /** The day the money was received, YYYY-MM-DD. */
  paidOn: string;
  note: string | null;
  receiptUrl: string | null;
  createdAt: Date;
}

/** What the subscription says about the money it is paid with; the payments module does not look it up. */
export interface NewPayment {
  subscriptionId: string;
  clientId: string;
  currency: string;
  amountMinor: number;
  method: PaymentMethod;
  paidOn: string;
  note?: string;
  recordedBy: string;
}

export interface PaymentListFilter {
  clientId?: string;
  subscriptionId?: string;
  method?: PaymentMethod;
  /** Both ends inclusive, YYYY-MM-DD. */
  from?: string;
  to?: string;
}

export interface PaymentSummary {
  totalMinor: number;
  count: number;
  byMethod: Partial<Record<PaymentMethod, number>>;
}
