/** What a reminder is about. The subscription kinds and the check-in one are built; the others are named by the schema for later. */
export enum ReminderKind {
  EXPIRING_SOON = 'expiring_soon',
  EXPIRED = 'expired',
  PAYMENT_DUE = 'payment_due',
  INTAKE_NUDGE = 'intake_nudge',
  /** A check-in link is ready for the client to fill in. */
  CHECKIN_DUE = 'checkin_due',
}
