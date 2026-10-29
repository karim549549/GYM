import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';
import { RefreshDto } from './refresh.dto';
import { RegisterDto } from './register.dto';
import { ResendDto } from './resend.dto';
import { VerifyDto } from './verify.dto';

const validRegistration = {
  phone: '01012345678',
  password: 'correct-horse-battery',
  fullName: '  Sara Ali ',
  acceptTerms: true,
};

async function problems<T extends object>(
  type: new () => T,
  plain: Record<string, unknown>,
) {
  const instance = plainToInstance(type, plain);
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { instance, fields: errors.map((error) => error.property) };
}

describe.each([
  ['RegisterDto', RegisterDto, validRegistration],
  ['LoginDto', LoginDto, { phone: '01012345678', password: 'whatever' }],
  ['VerifyDto', VerifyDto, { phone: '01012345678', code: '482913' }],
  ['ResendDto', ResendDto, { phone: '01012345678' }],
] as const)('the phone in %s', (_name, type, valid) => {
  it.each([
    ['01012345678', '+201012345678'],
    ['+20 101 234 5678', '+201012345678'],
    ['0020 101 234 5678', '+201012345678'],
    ['  01012345678  ', '+201012345678'],
  ])('reads %s as %s', async (phone, expected) => {
    const { instance, fields } = await problems(type as never, {
      ...valid,
      phone,
    });

    expect(fields).toEqual([]);
    expect((instance as { phone: string }).phone).toBe(expected);
  });

  it.each(['12345', 'call me', '', '+2010', '0101234567890123'])(
    'rejects %j',
    async (phone) => {
      const { fields } = await problems(type as never, { ...valid, phone });

      expect(fields).toContain('phone');
    },
  );

  it('is required', async () => {
    const plain: Record<string, unknown> = { ...valid };
    delete plain.phone;

    const { fields } = await problems(type as never, plain);

    expect(fields).toContain('phone');
  });
});

describe('RegisterDto', () => {
  it('accepts a complete registration and cleans it up', async () => {
    const { instance, fields } = await problems(RegisterDto, validRegistration);

    expect(fields).toEqual([]);
    expect(instance).toMatchObject({
      phone: '+201012345678',
      fullName: 'Sara Ali',
    });
  });

  it.each([
    ['password', 'short'],
    ['password', 'x'.repeat(73)],
    ['fullName', '   '],
    ['fullName', 'x'.repeat(121)],
  ])('rejects %s = %j', async (field, value) => {
    const { fields } = await problems(RegisterDto, {
      ...validRegistration,
      [field]: value,
    });

    expect(fields).toContain(field);
  });

  it.each(['password', 'fullName'])('requires %s', async (field) => {
    const plain: Record<string, unknown> = { ...validRegistration };
    delete plain[field];

    const { fields } = await problems(RegisterDto, plain);

    expect(fields).toContain(field);
  });

  it.each([false, 'true', undefined])(
    'refuses a registration that does not accept the terms (%j)',
    async (acceptTerms) => {
      const { fields } = await problems(RegisterDto, {
        ...validRegistration,
        acceptTerms,
      });

      expect(fields).toContain('acceptTerms');
    },
  );

  it('takes the platform notifications as an optional yes or no', async () => {
    expect(
      (
        await problems(RegisterDto, {
          ...validRegistration,
          platformNotifications: true,
        })
      ).fields,
    ).toEqual([]);
    expect(
      (
        await problems(RegisterDto, {
          ...validRegistration,
          platformNotifications: 'yes',
        })
      ).fields,
    ).toContain('platformNotifications');
  });

  it('keeps the password exactly as typed', async () => {
    const { instance } = await problems(RegisterDto, {
      ...validRegistration,
      password: '  spaced password  ',
    });

    expect(instance.password).toBe('  spaced password  ');
  });

  it('no longer takes an email or a brand name: those come later', async () => {
    const { fields } = await problems(RegisterDto, {
      ...validRegistration,
      email: 'sara@example.com',
      brandName: 'Sara Fit',
    });

    expect(fields).toEqual(expect.arrayContaining(['email', 'brandName']));
  });
});

describe('LoginDto', () => {
  it('accepts a phone and a password', async () => {
    const { fields } = await problems(LoginDto, {
      phone: '01012345678',
      password: 'whatever-it-was',
    });

    expect(fields).toEqual([]);
  });

  it('does not judge the strength of an existing password', async () => {
    const { fields } = await problems(LoginDto, {
      phone: '01012345678',
      password: 'x',
    });

    expect(fields).toEqual([]);
  });

  it.each(['', undefined, 42])('rejects the password %j', async (password) => {
    const { fields } = await problems(LoginDto, {
      phone: '01012345678',
      password,
    });

    expect(fields).toContain('password');
  });
});

describe('VerifyDto', () => {
  it.each(['482913', ' 482913 ', '0000', '1234567890'])(
    'accepts the code %j',
    async (code) => {
      const { instance, fields } = await problems(VerifyDto, {
        phone: '01012345678',
        code,
      });

      expect(fields).toEqual([]);
      expect(instance.code).toBe(code.trim());
    },
  );

  it.each(['', '123', '12345678901', '12 3456', 'abcdef', '12.456', '-12345'])(
    'rejects the code %j',
    async (code) => {
      const { fields } = await problems(VerifyDto, {
        phone: '01012345678',
        code,
      });

      expect(fields).toContain('code');
    },
  );

  it('requires the code', async () => {
    const { fields } = await problems(VerifyDto, { phone: '01012345678' });

    expect(fields).toContain('code');
  });
});

describe('RefreshDto', () => {
  it('accepts a refresh token', async () => {
    const { fields } = await problems(RefreshDto, { refreshToken: 'abc' });

    expect(fields).toEqual([]);
  });

  it.each(['', '   ', undefined, 42])('rejects %j', async (refreshToken) => {
    const { fields } = await problems(RefreshDto, { refreshToken });

    expect(fields).toContain('refreshToken');
  });
});
