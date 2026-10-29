/** Where a coach stands with the platform. Past due is worked out from the period's end, not stored. */
export enum PlatformSubscriptionStatus {
  TRIALING = 'trialing',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELLED = 'cancelled',
}
