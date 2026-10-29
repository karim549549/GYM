/** What an account holder agreed to when signing up, and may change later. */
export enum PersonConsentType {
  TERMS = 'terms',
  PRIVACY_POLICY = 'privacy_policy',
  /** Product and billing messages from the platform. Verification codes are not covered: they are the service itself. */
  PLATFORM_NOTIFICATIONS = 'platform_notifications',
}
