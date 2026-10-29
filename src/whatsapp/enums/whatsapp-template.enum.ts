/**
 * The message templates Meta has approved for us. WhatsApp only lets a business start a
 * conversation with a template, never free text, so every message names one of these.
 */
export enum WhatsAppTemplate {
  VERIFICATION_CODE = 'verification_code',
  /** To a client: their subscription with a coach is about to end. Client name, coach brand, end date. */
  SUBSCRIPTION_EXPIRING = 'subscription_expiring',
  /** To a client: their subscription with a coach ended. Client name, coach brand, end date. */
  SUBSCRIPTION_EXPIRED = 'subscription_expired',
  /** To a client: their check-in is ready. Client name, coach brand, link. */
  CHECKIN_DUE = 'checkin_due',
}
