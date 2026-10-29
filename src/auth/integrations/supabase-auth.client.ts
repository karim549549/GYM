import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isUUID } from 'class-validator';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { BaseClient, type ClientReply } from '../../common/clients/base.client';
import type { Env } from '../../config/env.schema';
import {
  AuthProviderUnavailableException,
  AuthRateLimitedException,
  InvalidCredentialsException,
  InvalidRefreshTokenException,
  InvalidTokenException,
  InvalidVerificationCodeException,
  PhoneAlreadyRegisteredException,
  PhoneNotConfirmedException,
  WeakPasswordException,
} from '../exceptions/auth-exceptions';
import type { AuthSession } from '../interfaces/auth-session.interface';
import type { VerifiedIdentity } from '../interfaces/verified-identity.interface';

export type SignOutScope = 'local' | 'global' | 'others';

/**
 * The only place that talks to Supabase Auth: verifies its access tokens and forwards
 * sign-up, code verification, sign-in, refresh and sign-out. The calls, their timeout
 * and their retries are the base client's; this class only says what each reply means.
 * It holds no business rules and never puts what Supabase replied into an error,
 * because replies can carry personal data.
 *
 * Verification codes are made, stored, expired and checked by Supabase. It hands each one
 * to the Send SMS hook (`auth/hooks`), which delivers it over WhatsApp, so no call here
 * names a channel.
 */
@Injectable()
export class SupabaseAuthClient extends BaseClient {
  // Failures that mean "this token is not acceptable". Anything else, such as an
  // unreachable key endpoint, is our problem and must not be reported as a bad token.
  private static readonly REJECTED_TOKEN_CODES = new Set([
    'ERR_JWT_EXPIRED',
    'ERR_JWT_INVALID',
    'ERR_JWT_CLAIM_VALIDATION_FAILED',
    'ERR_JWS_INVALID',
    'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
    'ERR_JOSE_ALG_NOT_ALLOWED',
    'ERR_JWKS_NO_MATCHING_KEY',
    'ERR_JWKS_MULTIPLE_MATCHING_KEYS',
  ]);

  // an unknown number must look the same as a known one when a code is asked for again
  private static readonly SILENT_RESEND_STATUSES = new Set([400, 404, 422]);

  private readonly authUrl: string;
  private readonly keys: JWTVerifyGetKey;

  constructor(config: ConfigService<Env, true>) {
    // `https://<project>.supabase.co/auth/v1`, which is also the issuer of its tokens
    const authUrl = `${config.get('SUPABASE_URL', { infer: true })}/auth/v1`;
    super({
      baseUrl: authUrl,
      headers: {
        apikey: config.get('SUPABASE_PUBLISHABLE_KEY', { infer: true }),
      },
    });
    this.authUrl = authUrl;
    this.keys = createRemoteJWKSet(new URL(`${authUrl}/.well-known/jwks.json`));
  }

  protected unavailable(): Error {
    return new AuthProviderUnavailableException();
  }

  async verify(token: string): Promise<VerifiedIdentity> {
    try {
      const { payload } = await jwtVerify(token, this.keys, {
        issuer: this.authUrl,
        audience: 'authenticated',
        algorithms: ['ES256', 'RS256'],
      });

      if (!payload.sub || !isUUID(payload.sub)) {
        throw new InvalidTokenException();
      }

      const metadata = payload.user_metadata as
        | {
            full_name?: unknown;
            terms_version?: unknown;
            platform_notifications?: unknown;
          }
        | undefined;
      return {
        authUserId: payload.sub,
        ...(typeof payload.phone === 'string' &&
          payload.phone && { phone: `+${payload.phone.replace(/^\+/, '')}` }),
        ...(typeof payload.email === 'string' &&
          payload.email && { email: payload.email }),
        ...(typeof metadata?.full_name === 'string' &&
          metadata.full_name && { fullName: metadata.full_name }),
        ...(typeof metadata?.terms_version === 'string' &&
          metadata.terms_version && {
            signupConsents: {
              termsVersion: metadata.terms_version,
              platformNotifications: metadata.platform_notifications === true,
            },
          }),
      };
    } catch (error) {
      if (error instanceof InvalidTokenException) {
        throw error;
      }
      const code = (error as { code?: unknown })?.code;
      if (
        typeof code === 'string' &&
        SupabaseAuthClient.REJECTED_TOKEN_CODES.has(code)
      ) {
        throw new InvalidTokenException();
      }
      throw error;
    }
  }

  /** Creates the login and has Supabase send a code to the phone. The person signs in only after confirming it. */
  async signUp(
    phone: string,
    password: string,
    fullName: string,
    consents: { termsVersion: string; platformNotifications: boolean },
  ): Promise<void> {
    const { status, body } = await this.send({
      method: 'POST',
      path: '/signup',
      body: {
        phone,
        password,
        data: {
          full_name: fullName,
          terms_version: consents.termsVersion,
          platform_notifications: consents.platformNotifications,
        },
      },
    });
    if (status !== 200) {
      throw this.signUpFailure(status, body);
    }
    // A session here means the project does not require the code, and the phone would
    // be unverified: refuse rather than let anyone in with a number they do not own.
    if (body?.access_token) {
      throw new AuthProviderUnavailableException();
    }
  }

  async verifyPhoneCode(phone: string, code: string): Promise<AuthSession> {
    // not repeated: a code is spent once, so a repeat after a lost reply would be refused
    const { status, body } = await this.send({
      method: 'POST',
      path: '/verify',
      body: { phone, token: code, type: 'sms' },
    });
    if (status !== 200) {
      throw this.verifyFailure(status);
    }
    return this.toSession(body);
  }

  async resendPhoneCode(phone: string): Promise<void> {
    const { status } = await this.send({
      method: 'POST',
      path: '/resend',
      body: { phone, type: 'sms' },
    });
    if (status >= 200 && status < 300) {
      return;
    }
    if (SupabaseAuthClient.SILENT_RESEND_STATUSES.has(status)) {
      return;
    }
    throw this.commonFailure(status);
  }

  /**
   * Has Supabase send a code to an account that already exists; it never makes one. A number
   * with no account is answered like one with an account, so nobody can use this to find out
   * who has signed up. Not repeated: each attempt sends another WhatsApp message.
   */
  async sendPhoneCode(phone: string): Promise<void> {
    const { status } = await this.send({
      method: 'POST',
      path: '/otp',
      body: { phone, create_user: false },
    });
    if (status >= 200 && status < 300) {
      return;
    }
    if (SupabaseAuthClient.SILENT_RESEND_STATUSES.has(status)) {
      return;
    }
    throw this.commonFailure(status);
  }

  /** Sets the password of the session this access token belongs to. */
  async updatePassword(
    accessToken: string,
    newPassword: string,
  ): Promise<void> {
    const { status, body } = await this.send({
      method: 'PUT',
      path: '/user',
      body: { password: newPassword },
      headers: { authorization: `Bearer ${accessToken}` },
      retry: true, // setting the same password twice changes nothing
    });
    if (status >= 200 && status < 300) {
      return;
    }
    // asked to set the password it already has: it is as asked
    if (body?.error_code === 'same_password') {
      return;
    }
    if (body?.error_code === 'weak_password') {
      throw new WeakPasswordException();
    }
    throw this.commonFailure(status);
  }

  async signInWithPassword(
    phone: string,
    password: string,
  ): Promise<AuthSession> {
    const { status, body } = await this.send({
      method: 'POST',
      path: '/token',
      query: { grant_type: 'password' },
      body: { phone, password },
      retry: true, // signing in again changes nothing
    });
    if (status !== 200) {
      throw this.signInFailure(status, body);
    }
    return this.toSession(body);
  }

  async refreshSession(refreshToken: string): Promise<AuthSession> {
    // not repeated: Supabase rotates the token, so a repeat after a lost reply is refused
    const { status, body } = await this.send({
      method: 'POST',
      path: '/token',
      query: { grant_type: 'refresh_token' },
      body: { refresh_token: refreshToken },
    });
    if (status !== 200) {
      throw this.refreshFailure(status);
    }
    return this.toSession(body);
  }

  /** Ends this session, or all of them, or all the others. A session that is already gone is fine. */
  async signOut(
    accessToken: string,
    scope: SignOutScope = 'local',
  ): Promise<void> {
    const { status } = await this.send({
      method: 'POST',
      path: '/logout',
      query: { scope },
      headers: { authorization: `Bearer ${accessToken}` },
      retry: true, // a session that is already gone is fine
    });
    if (status >= 200 && status < 300) {
      return;
    }
    if (status === 401 || status === 403 || status === 404) {
      return;
    }
    throw status === 429
      ? new AuthRateLimitedException()
      : new AuthProviderUnavailableException();
  }

  private signUpFailure(status: number, body: ClientReply['body']): Error {
    const code = body?.error_code;
    if (code === 'user_already_exists' || code === 'phone_exists') {
      return new PhoneAlreadyRegisteredException();
    }
    if (code === 'weak_password') {
      return new WeakPasswordException();
    }
    return this.commonFailure(status);
  }

  private verifyFailure(status: number): Error {
    if (status === 429) {
      return new AuthRateLimitedException();
    }
    return status >= 400 && status < 500
      ? new InvalidVerificationCodeException()
      : new AuthProviderUnavailableException();
  }

  private signInFailure(status: number, body: ClientReply['body']): Error {
    const code = body?.error_code;
    if (code === 'invalid_credentials') {
      return new InvalidCredentialsException();
    }
    if (code === 'phone_not_confirmed') {
      return new PhoneNotConfirmedException();
    }
    return this.commonFailure(status);
  }

  private refreshFailure(status: number): Error {
    if (status >= 400 && status < 500 && status !== 429) {
      return new InvalidRefreshTokenException();
    }
    return this.commonFailure(status);
  }

  private commonFailure(status: number): Error {
    return status === 429
      ? new AuthRateLimitedException()
      : new AuthProviderUnavailableException();
  }

  private toSession(body: ClientReply['body']): AuthSession {
    if (
      typeof body?.access_token !== 'string' ||
      typeof body?.refresh_token !== 'string' ||
      typeof body?.expires_in !== 'number'
    ) {
      throw new AuthProviderUnavailableException();
    }
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresIn: body.expires_in,
      tokenType: 'bearer',
    };
  }
}
