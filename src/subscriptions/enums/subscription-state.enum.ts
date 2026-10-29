/** What a coach sees about a subscription today. Never stored: it is wrong again tomorrow. */
export enum SubscriptionState {
  ACTIVE = 'active',
  EXPIRING_SOON = 'expiring_soon',
  EXPIRED = 'expired',
  FROZEN = 'frozen',
  PAYMENT_OVERDUE = 'payment_overdue',
  ENDED = 'ended',
  CANCELLED = 'cancelled',
}
