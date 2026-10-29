/** What is stored about a subscription. What the coach sees as its state is derived from this and the dates. */
export enum SubscriptionStatus {
  ACTIVE = 'active',
  FROZEN = 'frozen',
  ENDED = 'ended',
  CANCELLED = 'cancelled',
}
