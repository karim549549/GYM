import type { PaymentChannelMethod } from '../enums/payment-channel-method.enum';

export interface PaymentChannelRecord {
  id: string;
  method: PaymentChannelMethod;
  /** An InstaPay address (`name@instapay`) or phone number, a wallet number, or a bank account. */
  account: string;
  /** An https link that opens the payment app, when there is a public one. */
  url: string | null;
}

export interface NewPaymentChannel {
  method: PaymentChannelMethod;
  account: string;
  url?: string;
}

/** What a coach may change. null clears the link. */
export interface PaymentChannelChanges {
  method?: PaymentChannelMethod;
  account?: string;
  url?: string | null;
}
