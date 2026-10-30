import type { PaymentStatus } from '../enums/payment-status.enum';
import type { SubscriptionState } from '../enums/subscription-state.enum';
import type { SubscriptionStatus } from '../enums/subscription-status.enum';

/** A subscription as stored. Dates are calendar days, YYYY-MM-DD. */
export interface StoredSubscription {
  id: string;
  clientId: string;
  packageId: string | null;
  /** Copied from the package at the time of sale, with the price and currency. */
  packageName: string;
  /** In minor units (piastres). */
  priceMinor: number;
  currency: string;
  startsOn: string;
  endsOn: string;
  status: SubscriptionStatus;
  createdAt: Date;
}

/** A running subscription with how many calendar days (in Egypt) are left; negative once it is over. */
export interface LiveSubscription extends SubscriptionRecord {
  daysLeft: number;
}

/** A subscription as a coach sees it: what is stored, plus what is worked out from it today. */
export interface SubscriptionRecord extends StoredSubscription {
  state: SubscriptionState;
  paidMinor: number;
  dueMinor: number;
  paymentStatus: PaymentStatus;
}

export interface NewSubscription {
  clientId: string;
  packageId: string;
  packageName: string;
  priceMinor: number;
  currency: string;
  startsOn: string;
  endsOn: string;
}

/** What a coach asks for when selling; the rest comes from the package. */
export interface SubscriptionSale {
  packageId: string;
  startsOn?: string;
  /** The price agreed with this client when it differs from the package's. */
  priceMinor?: number;
}

export interface SubscriptionListFilter {
  clientId?: string;
  status?: SubscriptionStatus;
  /** Live subscriptions ending within this many days from today, today included. */
  endsWithinDays?: number;
}

/** The same filter once "within N days" has been turned into dates. */
export interface StoredSubscriptionFilter {
  clientId?: string;
  status?: SubscriptionStatus;
  endsFrom?: string;
  endsTo?: string;
}

export interface FreezeRecord {
  id: string;
  frozenOn: string;
  /** Null while the subscription is still frozen. */
  resumedOn: string | null;
  reason: string | null;
}

/** What the coach's business analytics reads from the subscriptions. */
export interface SubscriptionStatistics {
  /** For each day asked, how many clients had a subscription covering it. */
  coveredOn: { day: string; clients: number }[];
  /** Subscriptions that ended in the window, and how many the client renewed. */
  renewals: { ended: number; renewed: number };
  /** Clients who have had a subscription and the days they have been clients in all. */
  lifetime: { clients: number; totalDays: number };
}

export interface SubscriptionSummary {
  activeClients: number;
  renewalsDueThisWeek: number;
  /** The current month in Egypt, first day to last, for the revenue figure. */
  month: { from: string; to: string };
}
