import { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Webhook } from 'standardwebhooks';
import { InvalidHookSignatureException } from '../exceptions/auth-exceptions';
import { SupabaseHookGuard } from './supabase-hook.guard';

const SECRET_BASE64 = Buffer.from('a-test-signing-secret-0123456789').toString(
  'base64',
);
const SECRET = `v1,whsec_${SECRET_BASE64}`;
const payload = JSON.stringify({
  user: { id: 'u1', phone: '201012345678' },
  sms: { otp: '482913' },
});

function setup(secret: string | null = SECRET) {
  const config = {
    get: (name: string) =>
      name === 'SUPABASE_HOOK_SECRET' ? (secret ?? undefined) : undefined,
  } as unknown as ConfigService<never, true>;
  const guard = new SupabaseHookGuard(config);

  const signed = (
    body: string = payload,
    at: Date = new Date(),
    key: string = SECRET_BASE64,
  ) => {
    const id = 'msg_1';
    return {
      'webhook-id': id,
      'webhook-timestamp': String(Math.floor(at.getTime() / 1000)),
      'webhook-signature': new Webhook(key).sign(id, at, body),
    };
  };

  const run = (request: Record<string, unknown>) => {
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return guard.canActivate(context);
  };

  return { signed, run };
}

describe('SupabaseHookGuard', () => {
  it('lets a call Supabase signed through and hands on what it said', () => {
    const { signed, run } = setup();
    const request: Record<string, any> = {
      headers: signed(),
      rawBody: Buffer.from(payload),
    };

    expect(run(request)).toBe(true);
    expect(request.hookPayload).toEqual(JSON.parse(payload));
  });

  it('refuses a body changed after it was signed', () => {
    const { signed, run } = setup();
    const headers = signed();
    const tampered = payload.replace('482913', '000000');

    expect(() => run({ headers, rawBody: Buffer.from(tampered) })).toThrow(
      InvalidHookSignatureException,
    );
  });

  it('refuses a call signed with another secret', () => {
    const { signed, run } = setup();
    const otherKey = Buffer.from('another-secret-0123456789012345').toString(
      'base64',
    );

    expect(() =>
      run({
        headers: signed(payload, new Date(), otherKey),
        rawBody: Buffer.from(payload),
      }),
    ).toThrow(InvalidHookSignatureException);
  });

  it.each(['webhook-id', 'webhook-timestamp', 'webhook-signature'])(
    'refuses a call with no %s header',
    (missing) => {
      const { signed, run } = setup();
      const headers: Record<string, string> = signed();
      delete headers[missing];

      expect(() => run({ headers, rawBody: Buffer.from(payload) })).toThrow(
        InvalidHookSignatureException,
      );
    },
  );

  it('refuses a call that was signed long ago, so a copy cannot be replayed', () => {
    const { signed, run } = setup();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    expect(() =>
      run({
        headers: signed(payload, tenMinutesAgo),
        rawBody: Buffer.from(payload),
      }),
    ).toThrow(InvalidHookSignatureException);
  });

  it('refuses when the raw body was not kept, since the signature covers the exact bytes', () => {
    const { signed, run } = setup();

    expect(() => run({ headers: signed() })).toThrow(
      InvalidHookSignatureException,
    );
  });

  it('refuses everything when no secret is configured, even a well-formed call', () => {
    const { signed, run } = setup(null);

    expect(() =>
      run({ headers: signed(), rawBody: Buffer.from(payload) }),
    ).toThrow(InvalidHookSignatureException);
  });

  it('gives the same refusal whatever was wrong', () => {
    const { signed, run } = setup();
    const refusal = (request: Record<string, unknown>) => {
      try {
        run(request);
      } catch (error) {
        return (error as InvalidHookSignatureException).getResponse();
      }
    };

    const tampered = refusal({
      headers: signed(),
      rawBody: Buffer.from(payload + ' '),
    });
    const unsigned = refusal({ headers: {}, rawBody: Buffer.from(payload) });

    expect(tampered).toEqual(unsigned);
    expect(tampered).toMatchObject({ code: 'INVALID_HOOK_SIGNATURE' });
  });
});
