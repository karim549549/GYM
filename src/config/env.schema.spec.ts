import { validateEnv } from './env.schema';

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@host.example.com:6543/postgres',
  SUPABASE_URL: 'https://abcd1234.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
  PROGRAM_SESSION_SECRET: 'program-session-tests-only-secret-123456',
};

const s3Env = {
  STORAGE_DRIVER: 's3',
  STORAGE_S3_ACCESS_KEY_ID: 'test-access-key',
  STORAGE_S3_SECRET_ACCESS_KEY: 'test-secret-key',
  STORAGE_PUBLIC_URL: 'https://files.example.com',
};

describe('validateEnv', () => {
  it('fills defaults for optional variables', () => {
    const env = validateEnv(validEnv);

    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_POOL_MAX: 10,
      DATABASE_SSL_CA: 'certs/supabase-ca.crt',
    });
  });

  it('names the missing variable when SUPABASE_PUBLISHABLE_KEY is absent', () => {
    const { SUPABASE_PUBLISHABLE_KEY: _omitted, ...withoutKey } = validEnv;

    expect(() => validateEnv(withoutKey)).toThrow(/SUPABASE_PUBLISHABLE_KEY/);
  });

  it('rejects an empty SUPABASE_PUBLISHABLE_KEY', () => {
    expect(() =>
      validateEnv({ ...validEnv, SUPABASE_PUBLISHABLE_KEY: '' }),
    ).toThrow(/SUPABASE_PUBLISHABLE_KEY/);
  });

  it('converts numeric strings to numbers', () => {
    const env = validateEnv({
      ...validEnv,
      PORT: '8080',
      DATABASE_POOL_MAX: '25',
    });

    expect(env.PORT).toBe(8080);
    expect(env.DATABASE_POOL_MAX).toBe(25);
  });

  it('names the missing variable when DATABASE_URL is absent', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects a DATABASE_URL that is not a URL', () => {
    expect(() => validateEnv({ DATABASE_URL: 'not-a-url' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rejects a port outside the valid range', () => {
    expect(() => validateEnv({ ...validEnv, PORT: '70000' })).toThrow(/PORT/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validateEnv({ ...validEnv, NODE_ENV: 'staging-ish' })).toThrow(
      /NODE_ENV/,
    );
  });

  it('names the missing variable when SUPABASE_URL is absent', () => {
    const { SUPABASE_URL: _omitted, ...withoutSupabase } = validEnv;

    expect(() => validateEnv(withoutSupabase)).toThrow(/SUPABASE_URL/);
  });

  it('rejects a SUPABASE_URL that is not a URL', () => {
    expect(() => validateEnv({ ...validEnv, SUPABASE_URL: 'nope' })).toThrow(
      /SUPABASE_URL/,
    );
  });

  it('strips a trailing slash from SUPABASE_URL', () => {
    const env = validateEnv({
      ...validEnv,
      SUPABASE_URL: 'https://abcd1234.supabase.co/',
    });

    expect(env.SUPABASE_URL).toBe('https://abcd1234.supabase.co');
  });

  it('leaves LOG_LEVEL unset when it is not provided', () => {
    expect(validateEnv(validEnv).LOG_LEVEL).toBeUndefined();
  });

  it('accepts a known LOG_LEVEL', () => {
    expect(validateEnv({ ...validEnv, LOG_LEVEL: 'debug' }).LOG_LEVEL).toBe(
      'debug',
    );
  });

  it('rejects an unknown LOG_LEVEL', () => {
    expect(() => validateEnv({ ...validEnv, LOG_LEVEL: 'loud' })).toThrow(
      /LOG_LEVEL/,
    );
  });

  it('does not require the old Supabase Storage key', () => {
    expect(validateEnv(validEnv)).not.toHaveProperty('SUPABASE_SECRET_KEY');
  });

  describe('storage', () => {
    it('defaults to local storage and derives download URLs from PORT', () => {
      const env = validateEnv({ ...validEnv, PORT: '8080' });
      expect(env.STORAGE_DRIVER).toBe('local');
      expect(env.STORAGE_BASE_URL).toBe('http://localhost:8080/api/v1/storage');
    });

    it('requires S3 credentials and a public bucket URL only for the S3 driver', () => {
      expect(() => validateEnv({ ...validEnv, STORAGE_DRIVER: 's3' })).toThrow(
        /STORAGE_S3_ACCESS_KEY_ID/,
      );
      expect(() => validateEnv({ ...validEnv, ...s3Env })).not.toThrow();
    });

    it('does not treat the string false as true for path-style S3', () => {
      expect(
        validateEnv({ ...validEnv, STORAGE_S3_FORCE_PATH_STYLE: 'false' })
          .STORAGE_S3_FORCE_PATH_STYLE,
      ).toBe(false);
      expect(
        validateEnv({ ...validEnv, STORAGE_S3_FORCE_PATH_STYLE: 'true' })
          .STORAGE_S3_FORCE_PATH_STYLE,
      ).toBe(true);
    });

    it('refuses to combine public files, private files and photos in one bucket', () => {
      expect(() =>
        validateEnv({
          ...validEnv,
          ...s3Env,
          STORAGE_S3_PHOTOS_BUCKET: 'gym-public',
        }),
      ).toThrow(/separate buckets/);
    });

    it('refuses local storage in production', () => {
      expect(() =>
        validateEnv({
          ...validEnv,
          NODE_ENV: 'production',
          WHATSAPP_PROVIDER: 'meta',
          SUPABASE_HOOK_SECRET: 'test',
          PUBLIC_APP_URL: 'https://app.example.com',
        }),
      ).toThrow(/STORAGE_DRIVER/);
    });

    it('refuses an unknown driver and short signing keys', () => {
      expect(() =>
        validateEnv({ ...validEnv, STORAGE_DRIVER: 'memory' }),
      ).toThrow(/STORAGE_DRIVER/);
      expect(() =>
        validateEnv({ ...validEnv, STORAGE_SIGNING_KEY: 'short' }),
      ).toThrow(/STORAGE_SIGNING_KEY/);
    });
  });

  describe('WHATSAPP_PROVIDER', () => {
    it('is the mock unless told otherwise', () => {
      expect(validateEnv(validEnv).WHATSAPP_PROVIDER).toBe('mock');
    });

    it('accepts meta', () => {
      expect(
        validateEnv({ ...validEnv, WHATSAPP_PROVIDER: 'meta' })
          .WHATSAPP_PROVIDER,
      ).toBe('meta');
    });

    it('rejects an unknown provider', () => {
      expect(() =>
        validateEnv({ ...validEnv, WHATSAPP_PROVIDER: 'carrier-pigeon' }),
      ).toThrow(/WHATSAPP_PROVIDER/);
    });

    it('refuses the mock in production, where no code would ever be sent', () => {
      expect(() =>
        validateEnv({
          ...validEnv,
          NODE_ENV: 'production',
          ...s3Env,
          WHATSAPP_PROVIDER: 'mock',
        }),
      ).toThrow(/WHATSAPP_PROVIDER/);
    });

    it('allows the mock in development and test', () => {
      for (const NODE_ENV of ['development', 'test']) {
        expect(() =>
          validateEnv({ ...validEnv, NODE_ENV, WHATSAPP_PROVIDER: 'mock' }),
        ).not.toThrow();
      }
    });

    it('allows meta in production', () => {
      expect(() =>
        validateEnv({
          ...validEnv,
          NODE_ENV: 'production',
          ...s3Env,
          WHATSAPP_PROVIDER: 'meta',
          SUPABASE_HOOK_SECRET: 'v1,whsec_abc=',
          PUBLIC_APP_URL: 'https://app.example.com',
        }),
      ).not.toThrow();
    });
  });

  describe('PUBLIC_APP_URL', () => {
    it('has a development default, so a link can be made without setting anything', () => {
      expect(validateEnv(validEnv).PUBLIC_APP_URL).toBe(
        'http://localhost:3001',
      );
    });

    it('is taken as given, without a trailing slash', () => {
      expect(
        validateEnv({ ...validEnv, PUBLIC_APP_URL: 'https://app.example.com/' })
          .PUBLIC_APP_URL,
      ).toBe('https://app.example.com');
    });

    it('must be a url', () => {
      expect(() =>
        validateEnv({ ...validEnv, PUBLIC_APP_URL: 'not a url' }),
      ).toThrow(/PUBLIC_APP_URL/);
    });

    it('must be set in production, or every link would point at localhost', () => {
      const production = {
        ...validEnv,
        NODE_ENV: 'production',
        ...s3Env,
        WHATSAPP_PROVIDER: 'meta',
        SUPABASE_HOOK_SECRET: 'v1,whsec_abc=',
      };

      expect(() => validateEnv(production)).toThrow(/PUBLIC_APP_URL/);
      expect(() =>
        validateEnv({
          ...production,
          PUBLIC_APP_URL: 'https://app.example.com',
        }),
      ).not.toThrow();
    });
  });

  describe('SUPABASE_HOOK_SECRET', () => {
    const production = {
      ...validEnv,
      NODE_ENV: 'production',
      ...s3Env,
      WHATSAPP_PROVIDER: 'meta',
      PUBLIC_APP_URL: 'https://app.example.com',
    };

    it('may be left out in development', () => {
      expect(validateEnv(validEnv).SUPABASE_HOOK_SECRET).toBeUndefined();
    });

    it('is taken as given', () => {
      expect(
        validateEnv({ ...validEnv, SUPABASE_HOOK_SECRET: 'v1,whsec_abc=' })
          .SUPABASE_HOOK_SECRET,
      ).toBe('v1,whsec_abc=');
    });

    it('is required in production, or no verification code would ever be delivered', () => {
      expect(() => validateEnv(production)).toThrow(/SUPABASE_HOOK_SECRET/);
      expect(() =>
        validateEnv({ ...production, SUPABASE_HOOK_SECRET: 'v1,whsec_abc=' }),
      ).not.toThrow();
    });

    it('rejects an empty value', () => {
      expect(() =>
        validateEnv({ ...validEnv, SUPABASE_HOOK_SECRET: '' }),
      ).toThrow(/SUPABASE_HOOK_SECRET/);
    });
  });

  it('keeps unrelated variables out of the result', () => {
    const env = validateEnv({ ...validEnv, PATH: '/usr/bin' });

    expect(env).not.toHaveProperty('PATH');
  });
});
