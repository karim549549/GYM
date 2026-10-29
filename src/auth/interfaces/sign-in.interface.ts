import type { AuthSession } from './auth-session.interface';

/** The ways a person can obtain a session. Each ends in the same completion. */
export type SignInCredentials =
  | { kind: 'password'; phone: string; password: string }
  | { kind: 'phone_code'; phone: string; code: string };

export interface SignInResult {
  session: AuthSession;
  /** True when the login has no verified phone yet, so no person exists and the client must add one. */
  phoneRequired: boolean;
}
