/** The three messages a coach writes once: they go to the client with the name and dates filled in. */
export enum ReminderMessageKind {
  EXPIRING = 'expiring',
  EXPIRED = 'expired',
  PAYMENT_DUE = 'payment_due',
}
