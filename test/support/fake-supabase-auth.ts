import { randomInt, randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';

export const bare = (phone: string) => phone.replace(/^\+/, '');

interface FakeUser {
  id: string;
  password: string;
  fullName: string;
  consents: Record<string, unknown>;
  otp: string | null;
  confirmed: boolean;
}

/**
 * Answers the Supabase Auth calls the way Supabase does, including the part where it
 * makes a code and hands it to our Send SMS hook (`deliver`), which tests point at the
 * real hook endpoint. Used by every HTTP test, through `HttpTestApp`.
 */
export class FakeSupabaseAuth {
  readonly users = new Map<string, FakeUser>();
  readonly refreshTokens = new Map<string, string>();
  readonly signedOut: string[] = [];
  deliver: (phone: string, otp: string, userId: string) => Promise<void> =
    async () => undefined;

  constructor(
    private readonly privateKey: CryptoKey,
    private readonly authUrl: string,
    private readonly publishableKey: string,
  ) {}

  readonly fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : input);
    const headers = new Headers(init?.headers);
    if (headers.get('apikey') !== this.publishableKey) {
      return this.reply(401, { error_code: 'no_authorization' });
    }
    const body = init?.body ? JSON.parse(init.body as string) : {};

    if (url.pathname.endsWith('/signup')) {
      return this.signUp(body);
    }
    if (url.pathname.endsWith('/verify')) {
      return this.verify(body);
    }
    if (url.pathname.endsWith('/resend')) {
      return this.resend(body);
    }
    if (url.pathname.endsWith('/otp')) {
      return this.sendCode(body);
    }
    if (url.pathname.endsWith('/user') && init?.method === 'PUT') {
      return this.updateUser(headers.get('authorization'), body);
    }
    if (url.pathname.endsWith('/token')) {
      return url.searchParams.get('grant_type') === 'refresh_token'
        ? this.refresh(body)
        : this.signIn(body);
    }
    if (url.pathname.endsWith('/logout')) {
      const scope = url.searchParams.get('scope');
      const authorization = headers.get('authorization') ?? '';
      this.signedOut.push(`${scope} ${authorization}`);
      if (scope === 'global') {
        this.endEverySessionOf(authorization);
      }
      return new Response(null, { status: 204 });
    }
    return this.reply(404, {});
  };

  accessTokenFor(
    userId: string,
    phone: string,
    fullName = 'Someone',
    consents: Record<string, unknown> = {},
  ) {
    return new SignJWT({
      phone: bare(phone),
      user_metadata: { full_name: fullName, ...consents },
    })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setSubject(userId)
      .setIssuer(this.authUrl)
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .sign(this.privateKey);
  }

  private async signUp(body: Record<string, any>) {
    const key = bare(body.phone);
    const existing = this.users.get(key);
    if (existing?.confirmed) {
      return this.reply(422, { error_code: 'user_already_exists' });
    }
    const user = existing ?? {
      id: randomUUID(),
      password: body.password,
      fullName: body.data?.full_name ?? '',
      consents: {
        terms_version: body.data?.terms_version,
        platform_notifications: body.data?.platform_notifications,
      },
      otp: null,
      confirmed: false,
    };
    this.users.set(key, user);
    await this.issueCode(key, user);
    return this.reply(200, {
      id: user.id,
      phone: key,
      identities: [{ id: user.id }],
    });
  }

  /** Sends a code to an account that exists; it never makes one. */
  private async sendCode(body: Record<string, any>) {
    const key = bare(body.phone);
    const user = this.users.get(key);
    if (!user) {
      return this.reply(422, { error_code: 'otp_disabled' });
    }
    await this.issueCode(key, user);
    return this.reply(200, { message_id: randomUUID() });
  }

  private updateUser(authorization: string | null, body: Record<string, any>) {
    const key = this.phoneOf(authorization);
    const user = key ? this.users.get(key) : undefined;
    if (!user) {
      return this.reply(401, { error_code: 'bad_jwt' });
    }
    if (typeof body.password === 'string') {
      if (body.password.length < 8) {
        return this.reply(422, { error_code: 'weak_password' });
      }
      if (body.password === user.password) {
        return this.reply(422, { error_code: 'same_password' });
      }
      user.password = body.password;
    }
    return this.reply(200, { id: user.id });
  }

  private endEverySessionOf(authorization: string) {
    const key = this.phoneOf(authorization);
    for (const [token, owner] of this.refreshTokens) {
      if (owner === key) {
        this.refreshTokens.delete(token);
      }
    }
  }

  /** The phone a bearer token was issued for; the fake's tokens carry it. */
  private phoneOf(authorization: string | null): string | undefined {
    const token = authorization?.replace(/^Bearer /, '');
    const payload = token?.split('.')[1];
    if (!payload) {
      return undefined;
    }
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).phone;
  }

  private async resend(body: Record<string, any>) {
    const key = bare(body.phone);
    const user = this.users.get(key);
    if (!user || user.confirmed) {
      return this.reply(400, { error_code: 'user_not_found' });
    }
    await this.issueCode(key, user);
    return this.reply(200, { message_id: randomUUID() });
  }

  private async verify(body: Record<string, any>) {
    const key = bare(body.phone);
    const user = this.users.get(key);
    if (!user || user.otp === null || user.otp !== body.token) {
      return this.reply(403, { error_code: 'otp_expired' });
    }
    user.confirmed = true;
    user.otp = null;
    return this.reply(200, await this.sessionBody(user, key));
  }

  private async signIn(body: Record<string, any>) {
    const key = bare(body.phone);
    const user = this.users.get(key);
    if (!user || user.password !== body.password) {
      return this.reply(400, { error_code: 'invalid_credentials' });
    }
    if (!user.confirmed) {
      return this.reply(400, { error_code: 'phone_not_confirmed' });
    }
    return this.reply(200, await this.sessionBody(user, key));
  }

  private async refresh({ refresh_token }: Record<string, string>) {
    const owner = this.refreshTokens.get(refresh_token);
    if (!owner) {
      return this.reply(400, { error_code: 'refresh_token_not_found' });
    }
    this.refreshTokens.delete(refresh_token);
    const user = this.users.get(owner)!;
    return this.reply(200, await this.sessionBody(user, owner));
  }

  private async issueCode(key: string, user: FakeUser) {
    user.otp = String(randomInt(100_000, 999_999));
    await this.deliver(key, user.otp, user.id);
  }

  private async sessionBody(user: FakeUser, key: string) {
    const refreshToken = randomUUID();
    this.refreshTokens.set(refreshToken, key);
    return {
      access_token: await this.accessTokenFor(
        user.id,
        key,
        user.fullName,
        user.consents,
      ),
      refresh_token: refreshToken,
      expires_in: 3600,
      token_type: 'bearer',
      user: { id: user.id, phone: key, identities: [{ id: user.id }] },
    };
  }

  private reply(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }
}
