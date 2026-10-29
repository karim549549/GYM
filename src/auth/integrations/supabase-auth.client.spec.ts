import type { ConfigService } from '@nestjs/config';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
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
import { SupabaseAuthClient } from './supabase-auth.client';

const ISSUER = 'https://project.supabase.co/auth/v1';
const USER_ID = '8f14e45f-ceea-467a-9575-1c2f4e5e1b6a';
const JWKS_URL = `${ISSUER}/.well-known/jwks.json`;

const config = {
  get: (name: string) =>
    ({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
    })[name],
} as unknown as ConfigService<never, true>;

const urlOf = (input: string | URL | Request) =>
  new URL(input instanceof Request ? input.url : input);

afterEach(() => jest.restoreAllMocks());

async function createKey(kid: string) {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const jwk = {
    ...(await exportJWK(publicKey)),
    kid,
    alg: 'ES256',
    use: 'sig',
  };
  return { privateKey, jwk, kid };
}

const consents = { termsVersion: 'v1', platformNotifications: true };

describe('SupabaseAuthClient', () => {
  let signing: Awaited<ReturnType<typeof createKey>>;
  let stranger: Awaited<ReturnType<typeof createKey>>;
  let client: SupabaseAuthClient;

  const sign = (
    claims: Record<string, unknown> = {},
    options: {
      key?: typeof signing;
      issuer?: string;
      audience?: string;
      expiresIn?: string;
    } = {},
  ) => {
    const key = options.key ?? signing;
    return new SignJWT({ phone: '201012345678', ...claims })
      .setProtectedHeader({ alg: 'ES256', kid: key.kid })
      .setSubject(USER_ID)
      .setIssuer(options.issuer ?? ISSUER)
      .setAudience(options.audience ?? 'authenticated')
      .setIssuedAt()
      .setExpirationTime(options.expiresIn ?? '1h')
      .sign(key.privateKey);
  };

  beforeAll(async () => {
    signing = await createKey('signing-key');
    stranger = await createKey('signing-key');
  });

  // the client fetches Supabase's public keys itself, so the keys are served from here
  beforeEach(() => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      expect(urlOf(input).href).toBe(JWKS_URL);
      return Response.json({ keys: [signing.jwk] });
    });
    client = new SupabaseAuthClient(config);
  });

  it('returns the verified identity of a valid token', async () => {
    const identity = await client.verify(
      await sign({ email: 'coach@example.com' }),
    );

    expect(identity).toEqual({
      authUserId: USER_ID,
      phone: '+201012345678',
      email: 'coach@example.com',
    });
  });

  it('reads the name the person gave at signup', async () => {
    const identity = await client.verify(
      await sign({ user_metadata: { full_name: 'Sara Ali' } }),
    );

    expect(identity.fullName).toBe('Sara Ali');
  });

  it('reads what was agreed at signup', async () => {
    const identity = await client.verify(
      await sign({
        user_metadata: { terms_version: 'v1', platform_notifications: true },
      }),
    );

    expect(identity.signupConsents).toEqual({
      termsVersion: 'v1',
      platformNotifications: true,
    });
  });

  it('treats anything but true as a refusal of the optional notifications', async () => {
    const identity = await client.verify(
      await sign({
        user_metadata: { terms_version: 'v1', platform_notifications: 'yes' },
      }),
    );

    expect(identity.signupConsents?.platformNotifications).toBe(false);
  });

  it('carries no signup consents when the token has none', async () => {
    expect(await client.verify(await sign())).not.toHaveProperty(
      'signupConsents',
    );
  });

  it('leaves the name out when the token has none', async () => {
    expect(await client.verify(await sign())).not.toHaveProperty('fullName');
  });

  it('leaves the phone out when the token has none', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: signing.kid })
      .setSubject(USER_ID)
      .setIssuer(ISSUER)
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .sign(signing.privateKey);

    expect(await client.verify(token)).toEqual({ authUserId: USER_ID });
  });

  it('rejects an expired token', async () => {
    const token = await sign({}, { expiresIn: '-1m' });

    await expect(client.verify(token)).rejects.toBeInstanceOf(
      InvalidTokenException,
    );
  });

  it('rejects a token from another issuer', async () => {
    const token = await sign(
      {},
      { issuer: 'https://evil.example.com/auth/v1' },
    );

    await expect(client.verify(token)).rejects.toBeInstanceOf(
      InvalidTokenException,
    );
  });

  it('rejects a token meant for another audience', async () => {
    const token = await sign({}, { audience: 'somebody-else' });

    await expect(client.verify(token)).rejects.toBeInstanceOf(
      InvalidTokenException,
    );
  });

  it('rejects a token signed with a key we do not trust', async () => {
    const token = await sign({}, { key: stranger });

    await expect(client.verify(token)).rejects.toBeInstanceOf(
      InvalidTokenException,
    );
  });

  it('rejects a token that claims a symmetric algorithm', async () => {
    const token = await new SignJWT({ phone: '201012345678' })
      .setProtectedHeader({ alg: 'HS256', kid: signing.kid })
      .setSubject(USER_ID)
      .setIssuer(ISSUER)
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('any-shared-secret-value-1234567890'));

    await expect(client.verify(token)).rejects.toBeInstanceOf(
      InvalidTokenException,
    );
  });

  it('rejects an unsigned token', async () => {
    const encode = (value: object) =>
      Buffer.from(JSON.stringify(value)).toString('base64url');
    const token = `${encode({ alg: 'none' })}.${encode({
      sub: USER_ID,
      iss: ISSUER,
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 3600,
    })}.`;

    await expect(client.verify(token)).rejects.toBeInstanceOf(
      InvalidTokenException,
    );
  });

  it('rejects text that is not a token', async () => {
    await expect(client.verify('not-a-token')).rejects.toBeInstanceOf(
      InvalidTokenException,
    );
  });

  it('rejects a token whose subject is not a user id', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: signing.kid })
      .setSubject('not-a-uuid')
      .setIssuer(ISSUER)
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .sign(signing.privateKey);

    await expect(client.verify(token)).rejects.toBeInstanceOf(
      InvalidTokenException,
    );
  });

  it('does not call a key-service outage an invalid token', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('network down'));
    const token = await sign();

    const result = client.verify(token);

    await expect(result).rejects.toThrow();
    await expect(result).rejects.not.toBeInstanceOf(InvalidTokenException);
  });
});

// The shapes below are the ones the real Supabase Auth answers with.
describe('SupabaseAuthClient talking to Supabase', () => {
  type Call = { url: URL; init: RequestInit };

  const json = (status: number, body?: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  const session = {
    access_token: 'access.jwt.value',
    token_type: 'bearer',
    expires_in: 3600,
    refresh_token: 'refresh-value',
    user: { id: USER_ID, phone: '201012345678', identities: [{}] },
  };

  const expectedSession = {
    accessToken: 'access.jwt.value',
    refreshToken: 'refresh-value',
    expiresIn: 3600,
    tokenType: 'bearer',
  };

  // what Supabase answers a phone signup with while the code is still unconfirmed
  const unconfirmedUser = {
    id: USER_ID,
    phone: '201012345678',
    identities: [{}],
  };

  function clientAnswering(
    answer: (call: Call) => Response | Promise<Response>,
  ) {
    const calls: Call[] = [];
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const call = { url: urlOf(input), init: init ?? {} };
      calls.push(call);
      return answer(call);
    });
    return { client: new SupabaseAuthClient(config), calls };
  }

  const bodyOf = (call: Call) => JSON.parse(call.init.body as string);
  const headerOf = (call: Call, name: string) =>
    new Headers(call.init.headers).get(name);

  describe('signUp', () => {
    it('sends the phone, password and name to the signup endpoint with the publishable key', async () => {
      const { client, calls } = clientAnswering(() =>
        json(200, unconfirmedUser),
      );

      await client.signUp(
        '+201012345678',
        'a-good-password',
        'Sara Ali',
        consents,
      );

      expect(calls).toHaveLength(1);
      expect(calls[0].url.href).toBe(`${ISSUER}/signup`);
      expect(calls[0].init.method).toBe('POST');
      expect(bodyOf(calls[0])).toEqual({
        phone: '+201012345678',
        password: 'a-good-password',
        data: {
          full_name: 'Sara Ali',
          terms_version: 'v1',
          platform_notifications: true,
        },
      });
      expect(headerOf(calls[0], 'apikey')).toBe('test-publishable-key');
      expect(headerOf(calls[0], 'content-type')).toBe('application/json');
    });

    it('asks for no channel, so the Send SMS hook decides how the code is delivered', async () => {
      const { client, calls } = clientAnswering(() =>
        json(200, unconfirmedUser),
      );

      await client.signUp(
        '+201012345678',
        'a-good-password',
        'Sara Ali',
        consents,
      );

      expect(bodyOf(calls[0])).not.toHaveProperty('channel');
    });

    it('returns nothing: the person signs in only after confirming the code', async () => {
      const { client } = clientAnswering(() => json(200, unconfirmedUser));

      await expect(
        client.signUp('+201012345678', 'pw-long-enough', 'Sara', consents),
      ).resolves.toBeUndefined();
    });

    it('refuses a reply that already carries a session, because that means phone confirmation is switched off', async () => {
      const { client } = clientAnswering(() => json(200, session));

      await expect(
        client.signUp('+201012345678', 'pw-long-enough', 'Sara', consents),
      ).rejects.toBeInstanceOf(AuthProviderUnavailableException);
    });

    it.each([
      [
        422,
        { code: 422, error_code: 'user_already_exists', msg: 'exists' },
        PhoneAlreadyRegisteredException,
      ],
      [
        422,
        { code: 422, error_code: 'phone_exists', msg: 'exists' },
        PhoneAlreadyRegisteredException,
      ],
      [
        422,
        { code: 422, error_code: 'weak_password', msg: 'weak' },
        WeakPasswordException,
      ],
      [
        429,
        {
          code: 429,
          error_code: 'over_sms_send_rate_limit',
          msg: 'slow down',
        },
        AuthRateLimitedException,
      ],
      [500, { code: 500, msg: 'boom' }, AuthProviderUnavailableException],
      [
        500,
        { code: 500, error_code: 'sms_send_failed', msg: 'no hook' },
        AuthProviderUnavailableException,
      ],
      [
        422,
        { code: 422, error_code: 'phone_provider_disabled', msg: 'off' },
        AuthProviderUnavailableException,
      ],
    ])('maps %i %j to the right exception', async (status, body, expected) => {
      const { client } = clientAnswering(() => json(status, body));

      await expect(
        client.signUp('+201012345678', 'pw-long-enough', 'Sara', consents),
      ).rejects.toBeInstanceOf(expected);
    });
  });

  describe('verifyPhoneCode', () => {
    it('posts the phone, the code and the sms type, and returns the session', async () => {
      const { client, calls } = clientAnswering(() => json(200, session));

      const result = await client.verifyPhoneCode('+201012345678', '482913');

      expect(result).toEqual(expectedSession);
      expect(calls[0].url.href).toBe(`${ISSUER}/verify`);
      expect(calls[0].init.method).toBe('POST');
      expect(bodyOf(calls[0])).toEqual({
        phone: '+201012345678',
        token: '482913',
        type: 'sms',
      });
      expect(headerOf(calls[0], 'apikey')).toBe('test-publishable-key');
    });

    it.each([
      [
        403,
        {
          code: 403,
          error_code: 'otp_expired',
          msg: 'Token has expired or is invalid',
        },
      ],
      [400, { code: 400, error_code: 'validation_failed', msg: 'bad' }],
      [422, { code: 422, error_code: 'otp_disabled', msg: 'x' }],
    ])('treats %i %j as a wrong or expired code', async (status, body) => {
      const { client } = clientAnswering(() => json(status, body));

      await expect(
        client.verifyPhoneCode('+201012345678', '000000'),
      ).rejects.toBeInstanceOf(InvalidVerificationCodeException);
    });

    it('reports too many attempts as rate limited, not as a wrong code', async () => {
      const { client } = clientAnswering(() =>
        json(429, { code: 429, error_code: 'over_request_rate_limit' }),
      );

      await expect(
        client.verifyPhoneCode('+201012345678', '000000'),
      ).rejects.toBeInstanceOf(AuthRateLimitedException);
    });

    it('does not call an outage a wrong code', async () => {
      const { client } = clientAnswering(() => json(500, { msg: 'boom' }));

      await expect(
        client.verifyPhoneCode('+201012345678', '482913'),
      ).rejects.toBeInstanceOf(AuthProviderUnavailableException);
    });

    it('refuses a success that carries no session', async () => {
      const { client } = clientAnswering(() => json(200, {}));

      await expect(
        client.verifyPhoneCode('+201012345678', '482913'),
      ).rejects.toBeInstanceOf(AuthProviderUnavailableException);
    });
  });

  describe('resendPhoneCode', () => {
    it('asks Supabase for a new sms code for the phone', async () => {
      const { client, calls } = clientAnswering(() =>
        json(200, { message_id: 'm1' }),
      );

      await expect(
        client.resendPhoneCode('+201012345678'),
      ).resolves.toBeUndefined();

      expect(calls[0].url.href).toBe(`${ISSUER}/resend`);
      expect(bodyOf(calls[0])).toEqual({
        phone: '+201012345678',
        type: 'sms',
      });
    });

    it.each([400, 404, 422])(
      'does not reveal through a %i whether the number has an account',
      async (status) => {
        const { client } = clientAnswering(() =>
          json(status, { code: status, error_code: 'user_not_found' }),
        );

        await expect(
          client.resendPhoneCode('+201099999999'),
        ).resolves.toBeUndefined();
      },
    );

    it('reports too many requests as rate limited', async () => {
      const { client } = clientAnswering(() =>
        json(429, { code: 429, error_code: 'over_sms_send_rate_limit' }),
      );

      await expect(
        client.resendPhoneCode('+201012345678'),
      ).rejects.toBeInstanceOf(AuthRateLimitedException);
    });

    it('does not hide an outage', async () => {
      const { client } = clientAnswering(() => json(500, { msg: 'boom' }));

      await expect(
        client.resendPhoneCode('+201012345678'),
      ).rejects.toBeInstanceOf(AuthProviderUnavailableException);
    });
  });

  describe('signInWithPassword', () => {
    it('uses the password grant with the phone and returns the session', async () => {
      const { client, calls } = clientAnswering(() => json(200, session));

      const result = await client.signInWithPassword('+201012345678', 'pw');

      expect(result).toEqual(expectedSession);
      expect(calls[0].url.pathname).toBe('/auth/v1/token');
      expect(calls[0].url.searchParams.get('grant_type')).toBe('password');
      expect(bodyOf(calls[0])).toEqual({
        phone: '+201012345678',
        password: 'pw',
      });
    });

    it.each([
      [
        400,
        {
          code: 400,
          error_code: 'invalid_credentials',
          msg: 'Invalid login credentials',
        },
        InvalidCredentialsException,
      ],
      [
        400,
        {
          code: 400,
          error_code: 'phone_not_confirmed',
          msg: 'Phone not confirmed',
        },
        PhoneNotConfirmedException,
      ],
      [
        429,
        { code: 429, error_code: 'over_request_rate_limit', msg: 'slow' },
        AuthRateLimitedException,
      ],
      [500, { code: 500, msg: 'boom' }, AuthProviderUnavailableException],
    ])('maps %i %j to the right exception', async (status, body, expected) => {
      const { client } = clientAnswering(() => json(status, body));

      await expect(
        client.signInWithPassword('+201012345678', 'pw'),
      ).rejects.toBeInstanceOf(expected);
    });
  });

  describe('refreshSession', () => {
    it('uses the refresh grant and returns the new session', async () => {
      const { client, calls } = clientAnswering(() => json(200, session));

      const result = await client.refreshSession('old-refresh-value');

      expect(result).toEqual(expectedSession);
      expect(calls[0].url.searchParams.get('grant_type')).toBe('refresh_token');
      expect(bodyOf(calls[0])).toEqual({ refresh_token: 'old-refresh-value' });
    });

    it.each([
      [
        400,
        {
          code: 400,
          error_code: 'validation_failed',
          msg: 'Refresh token is not valid',
        },
      ],
      [400, { code: 400, error_code: 'refresh_token_not_found', msg: 'gone' }],
      [
        400,
        { code: 400, error_code: 'refresh_token_already_used', msg: 'used' },
      ],
      [401, { code: 401, error_code: 'session_not_found', msg: 'no session' }],
    ])('treats %i %j as an ended session', async (status, body) => {
      const { client } = clientAnswering(() => json(status, body));

      await expect(client.refreshSession('t')).rejects.toBeInstanceOf(
        InvalidRefreshTokenException,
      );
    });

    it('does not call an outage an ended session', async () => {
      const { client } = clientAnswering(() => json(503, { msg: 'down' }));

      await expect(client.refreshSession('t')).rejects.toBeInstanceOf(
        AuthProviderUnavailableException,
      );
    });
  });

  describe('signOut', () => {
    it('ends only this session by default, authenticated by the access token', async () => {
      const { client, calls } = clientAnswering(() => json(204));

      await expect(client.signOut('access.jwt.value')).resolves.toBeUndefined();

      expect(calls[0].url.pathname).toBe('/auth/v1/logout');
      expect(calls[0].url.searchParams.get('scope')).toBe('local');
      expect(headerOf(calls[0], 'authorization')).toBe(
        'Bearer access.jwt.value',
      );
      expect(headerOf(calls[0], 'apikey')).toBe('test-publishable-key');
    });

    it.each(['global', 'others'] as const)(
      'can end %s sessions instead',
      async (scope) => {
        const { client, calls } = clientAnswering(() => json(204));

        await client.signOut('access.jwt.value', scope);

        expect(calls[0].url.searchParams.get('scope')).toBe(scope);
      },
    );

    it.each([401, 403, 404])(
      'treats a %i as already signed out',
      async (status) => {
        const { client } = clientAnswering(() =>
          json(status, {
            code: status,
            error_code: 'bad_jwt',
            msg: 'invalid JWT',
          }),
        );

        await expect(client.signOut('stale.jwt')).resolves.toBeUndefined();
      },
    );

    it('does not hide an outage', async () => {
      const { client } = clientAnswering(() => json(500, { msg: 'boom' }));

      await expect(client.signOut('a.jwt')).rejects.toBeInstanceOf(
        AuthProviderUnavailableException,
      );
    });
  });

  describe('sendPhoneCode', () => {
    it('asks Supabase to send a code to an existing account, and never to make one', async () => {
      const { client, calls } = clientAnswering(() =>
        json(200, { message_id: 'm1' }),
      );

      await expect(
        client.sendPhoneCode('+201012345678'),
      ).resolves.toBeUndefined();

      expect(calls[0].url.href).toBe(`${ISSUER}/otp`);
      expect(calls[0].init.method).toBe('POST');
      expect(bodyOf(calls[0])).toEqual({
        phone: '+201012345678',
        create_user: false,
      });
      expect(headerOf(calls[0], 'apikey')).toBe('test-publishable-key');
    });

    it.each([400, 404, 422])(
      'does not reveal through a %i whether the number has an account',
      async (status) => {
        const { client } = clientAnswering(() =>
          json(status, { code: status, error_code: 'otp_disabled' }),
        );

        await expect(
          client.sendPhoneCode('+201099999999'),
        ).resolves.toBeUndefined();
      },
    );

    it('reports too many requests as rate limited', async () => {
      const { client } = clientAnswering(() =>
        json(429, { code: 429, error_code: 'over_sms_send_rate_limit' }),
      );

      await expect(
        client.sendPhoneCode('+201012345678'),
      ).rejects.toBeInstanceOf(AuthRateLimitedException);
    });

    it('does not hide an outage', async () => {
      const { client } = clientAnswering(() => json(500, { msg: 'boom' }));

      await expect(
        client.sendPhoneCode('+201012345678'),
      ).rejects.toBeInstanceOf(AuthProviderUnavailableException);
    });

    it('is never repeated, since each attempt sends another WhatsApp message', async () => {
      const { client, calls } = clientAnswering(() => json(503));

      await expect(
        client.sendPhoneCode('+201012345678'),
      ).rejects.toBeInstanceOf(AuthProviderUnavailableException);
      expect(calls).toHaveLength(1);
    });
  });

  describe('updatePassword', () => {
    it('sets the password of the session the access token belongs to', async () => {
      const { client, calls } = clientAnswering(() =>
        json(200, { id: USER_ID }),
      );

      await expect(
        client.updatePassword('access.jwt.value', 'a-brand-new-password'),
      ).resolves.toBeUndefined();

      expect(calls[0].url.href).toBe(`${ISSUER}/user`);
      expect(calls[0].init.method).toBe('PUT');
      expect(bodyOf(calls[0])).toEqual({ password: 'a-brand-new-password' });
      expect(headerOf(calls[0], 'authorization')).toBe(
        'Bearer access.jwt.value',
      );
      expect(headerOf(calls[0], 'apikey')).toBe('test-publishable-key');
    });

    it('counts setting the password it already has as done', async () => {
      const { client } = clientAnswering(() =>
        json(422, { code: 422, error_code: 'same_password', msg: 'same' }),
      );

      await expect(
        client.updatePassword('a.jwt', 'unchanged-password'),
      ).resolves.toBeUndefined();
    });

    it.each([
      [
        422,
        { code: 422, error_code: 'weak_password', msg: 'weak' },
        WeakPasswordException,
      ],
      [
        429,
        { code: 429, error_code: 'over_request_rate_limit' },
        AuthRateLimitedException,
      ],
      [500, { code: 500, msg: 'boom' }, AuthProviderUnavailableException],
      [
        401,
        { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' },
        AuthProviderUnavailableException,
      ],
    ])('maps %i %j to the right exception', async (status, body, expected) => {
      const { client } = clientAnswering(() => json(status, body));

      await expect(
        client.updatePassword('a.jwt', 'a-brand-new-password'),
      ).rejects.toBeInstanceOf(expected);
    });

    it('is repeated when it fails in transit, since setting the same password twice changes nothing', async () => {
      const { client, calls } = clientAnswering(() =>
        calls.length < 2 ? json(503) : json(200, {}),
      );

      await client.updatePassword('a.jwt', 'a-brand-new-password');

      expect(calls).toHaveLength(2);
    });
  });

  describe('when Supabase cannot be reached', () => {
    it.each([
      [
        'signUp',
        (c: SupabaseAuthClient) =>
          c.signUp('+201012345678', 'pw-long-enough', 'Sara', consents),
      ],
      [
        'verifyPhoneCode',
        (c: SupabaseAuthClient) => c.verifyPhoneCode('+201012345678', '123456'),
      ],
      [
        'resendPhoneCode',
        (c: SupabaseAuthClient) => c.resendPhoneCode('+201012345678'),
      ],
      [
        'signInWithPassword',
        (c: SupabaseAuthClient) => c.signInWithPassword('+201012345678', 'pw'),
      ],
      ['refreshSession', (c: SupabaseAuthClient) => c.refreshSession('t')],
      ['signOut', (c: SupabaseAuthClient) => c.signOut('a.jwt')],
    ])('reports %s as unavailable', async (_name, run) => {
      const { client } = clientAnswering(() => {
        throw new TypeError('fetch failed');
      });

      await expect(run(client)).rejects.toBeInstanceOf(
        AuthProviderUnavailableException,
      );
    });

    it('reports a reply that is not JSON as unavailable', async () => {
      const { client } = clientAnswering(
        () => new Response('<html>bad gateway</html>', { status: 502 }),
      );

      await expect(
        client.signInWithPassword('+201012345678', 'pw'),
      ).rejects.toBeInstanceOf(AuthProviderUnavailableException);
    });

    it('never puts the reply from Supabase into the error it throws', async () => {
      const { client } = clientAnswering(() =>
        json(500, { msg: 'secret-internal-detail for +201012345678' }),
      );

      const failure = await client
        .signInWithPassword('+201012345678', 'pw')
        .catch((error: unknown) => error);

      expect(JSON.stringify(failure)).not.toContain('secret-internal-detail');
      expect(JSON.stringify(failure)).not.toContain('+201012345678');
    });
  });

  describe('repeating a call that failed in transit', () => {
    const unavailable = () => json(503, { msg: 'down' });

    it('signs in again, because that changes nothing', async () => {
      const { client, calls } = clientAnswering(() =>
        calls.length < 2 ? unavailable() : json(200, session),
      );

      await expect(
        client.signInWithPassword('+201012345678', 'pw'),
      ).resolves.toMatchObject({ accessToken: session.access_token });
      expect(calls).toHaveLength(2);
    });

    it('signs out again, because a session that is gone is fine', async () => {
      const { client, calls } = clientAnswering(() =>
        calls.length < 2 ? unavailable() : json(204),
      );

      await client.signOut('access');

      expect(calls).toHaveLength(2);
    });

    it.each([
      [
        'creates the account',
        (c: SupabaseAuthClient) =>
          c.signUp('+201012345678', 'a-good-password', 'Sara', consents),
      ],
      [
        'spends a refresh token',
        (c: SupabaseAuthClient) => c.refreshSession('r'),
      ],
      [
        'spends a verification code',
        (c: SupabaseAuthClient) => c.verifyPhoneCode('+201012345678', '123456'),
      ],
      [
        'sends another WhatsApp message',
        (c: SupabaseAuthClient) => c.resendPhoneCode('+201012345678'),
      ],
    ])('never twice for a call that %s', async (_what, run) => {
      const { client, calls } = clientAnswering(() => unavailable());

      await expect(run(client)).rejects.toBeInstanceOf(
        AuthProviderUnavailableException,
      );
      expect(calls).toHaveLength(1);
    });
  });
});
