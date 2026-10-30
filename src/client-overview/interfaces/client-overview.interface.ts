import type { ClientRecord } from '../../clients/interfaces/client.interface';
import type { SubscriptionState } from '../../subscriptions/enums/subscription-state.enum';

/** A client's running subscription, as the clients list shows it. */
export interface ClientSubscriptionSummary {
  id: string;
  packageName: string;
  state: SubscriptionState;
  /** The last day covered, YYYY-MM-DD. */
  endsOn: string;
  /** Calendar days (in Egypt) until it ends; negative once it is over. */
  daysLeft: number;
}

/** What the clients list shows next to each client, worked out on every read. */
export interface ClientSummary {
  /** The running (active or frozen) subscription, or null when the client has none. */
  subscription: ClientSubscriptionSummary | null;
  /** Whether the client follows an active workout plan. */
  hasPlan: boolean;
  /** Days until the next check-in; 0 is today, null when none is planned. */
  nextCheckinInDays: number | null;
  /** Check-ins missed in the last thirty days. */
  missedCheckins: number;
}

export interface ClientOverview extends ClientRecord {
  summary: ClientSummary;
}
