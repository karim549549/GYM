/** Who a token proved the caller to be, independent of who issued the token. */
export interface VerifiedIdentity {
  authUserId: string;
  phone?: string;
  email?: string;
  /** The name given at signup, when the token carries it. */
  fullName?: string;
  /** What was agreed at signup, carried by the token until the person is created. */
  signupConsents?: { termsVersion: string; platformNotifications: boolean };
}
