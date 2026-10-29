import { randomUUID } from 'node:crypto';
import { HttpTestApp } from './support/http-test-app';
import type { FakeSupabaseAuth } from './support/fake-supabase-auth';
import type { MockWhatsAppClient } from '../src/whatsapp/integrations/mock-whatsapp.client';

const PASSWORD = HttpTestApp.PASSWORD;

describe('Auth over HTTP', () => {
  let harness: HttpTestApp;
  let supabase: FakeSupabaseAuth;
  let whatsapp: MockWhatsAppClient;

  const bare = (phone: string) => phone.replace(/^\+/, '');
  const server = () => harness.server();
  const uniquePhone = () => harness.uniquePhone();
  const registration = (overrides: Record<string, unknown> = {}) =>
    harness.registration(overrides);
  const codeSentTo = (phone: string) => harness.codeSentTo(phone);
  const signedUpPerson = (overrides: Record<string, unknown> = {}) =>
    harness.signedUpPerson(overrides);
  const personRow = (phone: string) => harness.personRow(phone);
  const me = (accessToken: string) => harness.me(accessToken);
  const signedHookCall = (
    payload: unknown,
    options: { secret?: string; at?: Date } = {},
  ) => harness.signedHookCall(payload, options);

  beforeAll(async () => {
    harness = await HttpTestApp.start();
    ({ supabase, whatsapp } = harness);
  });

  afterAll(() => harness.stop(), 60_000);

  it('keeps the health check open to everyone', async () => {
    await server().get('/health').expect(200);
  });

  describe('protecting routes', () => {
    it('refuses a request with no token', async () => {
      const response = await server().get('/api/v1/auth/me').expect(401);

      expect(response.body).toMatchObject({
        code: 'MISSING_TOKEN',
        requestId: expect.any(String),
      });
    });

    it('refuses a token that is not valid', async () => {
      const response = await me('not.a.token').expect(401);

      expect(response.body.code).toBe('INVALID_TOKEN');
    });

    it('tells a verified login that has no person to finish registering', async () => {
      const token = await supabase.accessTokenFor(randomUUID(), uniquePhone());

      const response = await me(token).expect(403);

      expect(response.body.code).toBe('NOT_REGISTERED');
    });
  });

  describe('signing up with a phone and a password', () => {
    it('sends a code over WhatsApp and creates nobody yet', async () => {
      const body = registration();

      const response = await server()
        .post('/api/v1/auth/register')
        .send(body)
        .expect(202);

      expect(response.body).toEqual({});
      expect(whatsapp.lastTo(body.phone)).toEqual({
        to: body.phone,
        template: 'verification_code',
        language: 'ar',
        params: [expect.stringMatching(/^\d{6}$/)],
      });
      expect(await personRow(body.phone)).toBeUndefined();
      expect(JSON.stringify(whatsapp.outbox)).not.toContain(PASSWORD);
    });

    it('creates the person, and signs them in, when the code is confirmed', async () => {
      const body = registration({ fullName: '  Sara Ali  ' });
      await server().post('/api/v1/auth/register').send(body).expect(202);

      const response = await server()
        .post('/api/v1/auth/verify')
        .send({ phone: body.phone, code: codeSentTo(body.phone) })
        .expect(200);

      expect(response.body).toEqual({
        session: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          expiresIn: 3600,
          tokenType: 'bearer',
        },
        phoneRequired: false,
      });
      expect(await personRow(body.phone)).toMatchObject({
        phone: body.phone,
        fullName: 'Sara Ali',
      });

      const profile = await me(response.body.session.accessToken).expect(200);
      expect(profile.body).toEqual({
        personId: expect.any(String),
        fullName: 'Sara Ali',
        workspaces: [],
      });
    });

    it('accepts a number typed the local way and keeps it international', async () => {
      const local = `0${uniquePhone().slice(3)}`;
      const international = `+20${local.slice(1)}`;
      harness.trackPhone(international);
      await server()
        .post('/api/v1/auth/register')
        .send({
          phone: local,
          password: PASSWORD,
          fullName: 'Local Typist',
          acceptTerms: true,
        })
        .expect(202);

      await server()
        .post('/api/v1/auth/verify')
        .send({ phone: local, code: codeSentTo(international) })
        .expect(200);

      expect(await personRow(international)).toBeDefined();
    });

    it('refuses a wrong code and creates nobody', async () => {
      const body = registration();
      await server().post('/api/v1/auth/register').send(body).expect(202);

      const response = await server()
        .post('/api/v1/auth/verify')
        .send({ phone: body.phone, code: '000000' })
        .expect(400);

      expect(response.body.code).toBe('INVALID_VERIFICATION_CODE');
      expect(await personRow(body.phone)).toBeUndefined();
    });

    it('does not accept a code twice', async () => {
      const body = registration();
      await server().post('/api/v1/auth/register').send(body).expect(202);
      const code = codeSentTo(body.phone);
      await server()
        .post('/api/v1/auth/verify')
        .send({ phone: body.phone, code })
        .expect(200);

      const again = await server()
        .post('/api/v1/auth/verify')
        .send({ phone: body.phone, code })
        .expect(400);

      expect(again.body.code).toBe('INVALID_VERIFICATION_CODE');
    });

    it('does not let anyone sign in before the phone is confirmed', async () => {
      const body = registration();
      await server().post('/api/v1/auth/register').send(body).expect(202);

      const response = await server()
        .post('/api/v1/auth/login')
        .send({ phone: body.phone, password: PASSWORD })
        .expect(403);

      expect(response.body.code).toBe('PHONE_NOT_CONFIRMED');
    });

    it('sends a fresh code when asked again, and only the new one works', async () => {
      const body = registration();
      await server().post('/api/v1/auth/register').send(body).expect(202);
      const first = codeSentTo(body.phone);

      await server()
        .post('/api/v1/auth/resend')
        .send({ phone: body.phone })
        .expect(204);
      const second = codeSentTo(body.phone);

      expect(whatsapp.outbox.filter((m) => m.to === body.phone)).toHaveLength(
        2,
      );
      expect(second).not.toBe(first);
      await server()
        .post('/api/v1/auth/verify')
        .send({ phone: body.phone, code: first })
        .expect(400);
      await server()
        .post('/api/v1/auth/verify')
        .send({ phone: body.phone, code: second })
        .expect(200);
    });

    it('answers a resend for an unknown number the same way, revealing nothing', async () => {
      await server()
        .post('/api/v1/auth/resend')
        .send({ phone: uniquePhone() })
        .expect(204);
    });

    it('registering again before confirming just sends another code', async () => {
      const body = registration();
      await server().post('/api/v1/auth/register').send(body).expect(202);

      await server().post('/api/v1/auth/register').send(body).expect(202);

      expect(whatsapp.outbox.filter((m) => m.to === body.phone)).toHaveLength(
        2,
      );
    });

    it('refuses a number that already has an account', async () => {
      const { body } = await signedUpPerson();

      const response = await server()
        .post('/api/v1/auth/register')
        .send({ ...body, fullName: 'Someone Else' })
        .expect(409);

      expect(response.body.code).toBe('PHONE_ALREADY_REGISTERED');
    });

    it('validates the registration body', async () => {
      const response = await server()
        .post('/api/v1/auth/register')
        .send({ phone: '123', password: 'short', role: 'admin' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_FAILED');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.stringContaining('phone'),
          expect.stringContaining('password'),
          expect.stringContaining('fullName'),
          expect.stringContaining('role should not exist'),
        ]),
      );
    });
  });

  describe('POST /auth/login', () => {
    it('signs in a confirmed person with phone and password', async () => {
      const { body } = await signedUpPerson();

      const response = await server()
        .post('/api/v1/auth/login')
        .send({ phone: body.phone, password: PASSWORD })
        .expect(200);

      expect(response.body.phoneRequired).toBe(false);
      await me(response.body.session.accessToken).expect(200);
    });

    it('records when the person last signed in, and moves it forward', async () => {
      const { body } = await signedUpPerson();
      const afterSignup = (await personRow(body.phone as string)).lastLoginAt;
      expect(afterSignup).toBeInstanceOf(Date);

      await new Promise((resolve) => setTimeout(resolve, 20));
      await server()
        .post('/api/v1/auth/login')
        .send({ phone: body.phone, password: PASSWORD })
        .expect(200);

      const afterLogin = (await personRow(body.phone as string)).lastLoginAt;
      expect(afterLogin!.getTime()).toBeGreaterThan(afterSignup!.getTime());
    });

    it('does not count a refresh or a failed attempt as a login', async () => {
      const { body, session } = await signedUpPerson();
      const stamped = (await personRow(body.phone as string)).lastLoginAt;

      await server()
        .post('/api/v1/auth/login')
        .send({ phone: body.phone, password: 'wrong-password' })
        .expect(401);
      await server()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(200);

      expect((await personRow(body.phone as string)).lastLoginAt).toEqual(
        stamped,
      );
    });

    it('does not say whether the phone or the password was wrong', async () => {
      const { body } = await signedUpPerson();

      const wrongPassword = await server()
        .post('/api/v1/auth/login')
        .send({ phone: body.phone, password: 'not-the-password' })
        .expect(401);
      const unknownPhone = await server()
        .post('/api/v1/auth/login')
        .send({ phone: uniquePhone(), password: PASSWORD })
        .expect(401);

      expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS');
      expect(unknownPhone.body).toEqual({
        ...wrongPassword.body,
        requestId: unknownPhone.body.requestId,
        timestamp: unknownPhone.body.timestamp,
      });
    });

    it('validates the body', async () => {
      const response = await server()
        .post('/api/v1/auth/login')
        .send({ phone: 'nope' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('POST /auth/refresh', () => {
    it('trades a refresh token for a new session, once', async () => {
      const { session } = await signedUpPerson();

      const renewed = await server()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(200);
      expect(renewed.body.accessToken).toEqual(expect.any(String));
      expect(renewed.body.refreshToken).not.toBe(session.refreshToken);

      const replay = await server()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(401);
      expect(replay.body.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('validates the body', async () => {
      await server().post('/api/v1/auth/refresh').send({}).expect(400);
    });
  });

  describe('POST /auth/logout', () => {
    it('ends the session of the token it was called with', async () => {
      const { session } = await signedUpPerson();

      await server()
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(204);

      expect(supabase.signedOut).toContain(
        `local Bearer ${session.accessToken}`,
      );
    });

    it('needs a token', async () => {
      const response = await server().post('/api/v1/auth/logout').expect(401);

      expect(response.body.code).toBe('MISSING_TOKEN');
    });
  });

  describe('POST /auth/logout/all', () => {
    it('ends the sessions on every device, not just this one', async () => {
      const { session } = await signedUpPerson();

      await server()
        .post('/api/v1/auth/logout/all')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(204);

      expect(supabase.signedOut).toContain(
        `global Bearer ${session.accessToken}`,
      );
      expect(supabase.signedOut).not.toContain(
        `local Bearer ${session.accessToken}`,
      );
    });

    it('needs a token', async () => {
      const response = await server()
        .post('/api/v1/auth/logout/all')
        .expect(401);

      expect(response.body.code).toBe('MISSING_TOKEN');
    });
  });

  describe('forgetting the password', () => {
    const NEW_PASSWORD = 'a-completely-new-password';

    const forgot = (phone: string) =>
      server().post('/api/v1/auth/password/forgot').send({ phone });
    const reset = (body: Record<string, unknown>) =>
      server().post('/api/v1/auth/password/reset').send(body);
    const login = (phone: unknown, password: string) =>
      server().post('/api/v1/auth/login').send({ phone, password });

    /** Asks for a code the way a person who forgot would, and returns it. */
    const codeFor = async (phone: string) => {
      await forgot(phone).expect(202);
      return codeSentTo(phone) as string;
    };

    describe('POST /auth/password/forgot', () => {
      it('sends a code over WhatsApp to a person who has an account', async () => {
        const { body } = await signedUpPerson();
        const before = whatsapp.outbox.length;

        const response = await forgot(body.phone as string).expect(202);

        expect(response.body).toEqual({});
        expect(whatsapp.outbox).toHaveLength(before + 1);
        expect(whatsapp.lastTo(body.phone as string)?.template).toBe(
          'verification_code',
        );
      });

      it('answers a number nobody has the same way, and sends nothing', async () => {
        const stranger = uniquePhone();

        await forgot(stranger).expect(202);

        expect(whatsapp.lastTo(stranger)).toBeUndefined();
      });

      it('refuses something that is not a phone number', async () => {
        const response = await forgot('nope').expect(400);

        expect(response.body.code).toBe('VALIDATION_FAILED');
      });
    });

    describe('POST /auth/password/reset', () => {
      it('sets the new password, which then works, and the old one no longer does', async () => {
        const { body } = await signedUpPerson();
        const phone = body.phone as string;
        const code = await codeFor(phone);

        const response = await reset({
          phone,
          code,
          newPassword: NEW_PASSWORD,
        }).expect(204);

        expect(response.body).toEqual({});
        await login(phone, PASSWORD).expect(401);
        await login(phone, NEW_PASSWORD).expect(200);
      });

      it('signs the person in nowhere: a code proves the phone, nothing more', async () => {
        const { body } = await signedUpPerson();
        const phone = body.phone as string;
        const code = await codeFor(phone);

        const response = await reset({
          phone,
          code,
          newPassword: NEW_PASSWORD,
        });

        expect(JSON.stringify(response.body)).not.toMatch(/token/i);
        expect(response.headers['set-cookie']).toBeUndefined();
      });

      it('ends every session the person had, so a stolen one stops working', async () => {
        const { body, session } = await signedUpPerson();
        const phone = body.phone as string;
        const code = await codeFor(phone);

        await reset({ phone, code, newPassword: NEW_PASSWORD }).expect(204);

        const stale = await server()
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: session.refreshToken })
          .expect(401);
        expect(stale.body.code).toBe('INVALID_REFRESH_TOKEN');
      });

      it('is not counted as a login', async () => {
        const { body } = await signedUpPerson();
        const phone = body.phone as string;
        const stamped = (await personRow(phone)).lastLoginAt;
        const code = await codeFor(phone);

        await reset({ phone, code, newPassword: NEW_PASSWORD }).expect(204);

        expect((await personRow(phone)).lastLoginAt).toEqual(stamped);
      });

      it('refuses a wrong code and leaves the password as it was', async () => {
        const { body } = await signedUpPerson();
        const phone = body.phone as string;
        await codeFor(phone);

        const response = await reset({
          phone,
          code: '000000',
          newPassword: NEW_PASSWORD,
        }).expect(400);

        expect(response.body.code).toBe('INVALID_VERIFICATION_CODE');
        await login(phone, PASSWORD).expect(200);
      });

      it('does not accept a code twice', async () => {
        const { body } = await signedUpPerson();
        const phone = body.phone as string;
        const code = await codeFor(phone);
        await reset({ phone, code, newPassword: NEW_PASSWORD }).expect(204);

        const again = await reset({
          phone,
          code,
          newPassword: 'yet-another-password',
        }).expect(400);

        expect(again.body.code).toBe('INVALID_VERIFICATION_CODE');
        await login(phone, NEW_PASSWORD).expect(200);
      });

      it('refuses a number that never asked for a code', async () => {
        const response = await reset({
          phone: uniquePhone(),
          code: '123456',
          newPassword: NEW_PASSWORD,
        }).expect(400);

        expect(response.body.code).toBe('INVALID_VERIFICATION_CODE');
      });

      it.each([
        ['no password', { code: '123456' }],
        [
          'a password that is too short',
          { code: '123456', newPassword: 'short' },
        ],
        [
          'a password that is too long',
          { code: '123456', newPassword: 'x'.repeat(73) },
        ],
        ['no code', { newPassword: NEW_PASSWORD }],
        ['a code with letters', { code: 'abcdef', newPassword: NEW_PASSWORD }],
        [
          'a field it does not know',
          { code: '123456', newPassword: NEW_PASSWORD, role: 'admin' },
        ],
      ])('refuses %s', async (_label, fields) => {
        const { body } = await signedUpPerson();

        const response = await reset({ phone: body.phone, ...fields }).expect(
          400,
        );

        expect(response.body.code).toBe('VALIDATION_FAILED');
      });
    });
  });

  describe('the hook Supabase calls to deliver a code', () => {
    const payload = (phone = '201012345678', otp = '482913') => ({
      user: { id: randomUUID(), phone, email: '' },
      sms: { otp },
    });

    it('delivers the code it is given over WhatsApp', async () => {
      const phone = uniquePhone();

      await signedHookCall(payload(bare(phone), '135790')).expect(200);

      expect(whatsapp.lastTo(phone)?.params).toEqual(['135790']);
    });

    it('refuses a call with no signature at all', async () => {
      const response = await server()
        .post('/api/v1/auth/hooks/send-sms')
        .send(payload())
        .expect(401);

      expect(response.body.code).toBe('INVALID_HOOK_SIGNATURE');
    });

    it('refuses a call signed with another secret, and sends nothing', async () => {
      const phone = uniquePhone();
      const other = Buffer.from('some-other-secret-0123456789012').toString(
        'base64',
      );

      await signedHookCall(payload(bare(phone)), { secret: other }).expect(401);

      expect(whatsapp.lastTo(phone)).toBeUndefined();
    });

    it('refuses a call signed long ago', async () => {
      await signedHookCall(payload(), {
        at: new Date(Date.now() - 10 * 60 * 1000),
      }).expect(401);
    });

    it('refuses a signed call that is not what we expect, and sends nothing', async () => {
      const before = whatsapp.outbox.length;

      const response = await signedHookCall({ hello: 'world' }).expect(400);

      expect(response.body.code).toBe('INVALID_HOOK_PAYLOAD');
      expect(whatsapp.outbox).toHaveLength(before);
    });
  });
});
