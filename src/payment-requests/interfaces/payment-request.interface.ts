import type { PaymentMethod } from '../../payments/enums/payment-method.enum';

/** Worked out from the dates and from whether the client reported paying; never stored. */
export type PaymentRequestState = 'waiting' | 'paid' | 'confirmed' | 'expired';

/** A payment request as stored. */
export interface StoredPaymentRequest {
  id: string;
  workspaceId: string;
  subscriptionId: string;
  clientId: string;
  token: string;
  clientName: string;
  packageName: string;
  /** In minor units (piastres). */
  amountMinor: number;
  currency: string;
  note: string | null;
  expiresAt: Date;
  paidAt: Date | null;
  paidMethod: PaymentMethod | null;
  receiptKey: string | null;
  /** Set once the coach confirmed the report, which recorded a payment. */
  paymentId: string | null;
  createdAt: Date;
}

export interface NewPaymentRequest {
  subscriptionId: string;
  clientId: string;
  token: string;
  clientName: string;
  packageName: string;
  amountMinor: number;
  currency: string;
  note?: string;
  expiresAt: Date;
  createdBy: string;
}

/** What the coach sees: the stored request without the workspace, and its state. */
export interface PaymentRequestRecord extends Omit<
  StoredPaymentRequest,
  'workspaceId' | 'receiptKey'
> {
  state: PaymentRequestState;
  /** A link that expires, for the screenshot the client sent; null until they did. */
  receiptUrl: string | null;
}

/**
 * What anyone holding the address sees: the coach's brand and what is asked, never ids or the client's
 * phone number. The client's name is the one the coach saw when making the link.
 */
export interface PublicPaymentRequestView {
  coach: { brandName: string; logoUrl: string | null };
  /** Where the client can send the money: the coach's payment channels. */
  channels: { method: string; account: string; url: string | null }[];
  clientName: string;
  packageName: string;
  amountMinor: number;
  currency: string;
  note: string | null;
  expiresAt: Date;
  state: PaymentRequestState;
  paidMethod: PaymentMethod | null;
}
