/** What a client holds to stay signed in. The strings are opaque to the client. */
export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
  tokenType: 'bearer';
}
