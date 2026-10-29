import type { ConsentsService } from '../../consents/consents.service';
import type { PeopleService } from '../../people/people.service';
import type { TransactionManager } from '../../database/transaction.manager';
import {
  InvalidCredentialsException,
  InvalidVerificationCodeException,
} from '../exceptions/auth-exceptions';
import type { SupabaseAuthClient } from '../integrations/supabase-auth.client';
import type { AuthSession } from '../interfaces/auth-session.interface';
import type { VerifiedIdentity } from '../interfaces/verified-identity.interface';
import { SignInOrchestrator } from './sign-in.orchestrator';

const session: AuthSession = {
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresIn: 3600,
  tokenType: 'bearer',
};
const identity: VerifiedIdentity = {
  authUserId: '8f14e45f-ceea-467a-9575-1c2f4e5e1b6a',
  phone: '+201012345678',
  fullName: 'Sara Ali',
};
const password = {
  kind: 'password',
  phone: '+201012345678',
  password: 'pw',
} as const;
const code = {
  kind: 'phone_code',
  phone: '+201012345678',
  code: '482913',
} as const;

function setup(found: unknown = { id: 'person-1', fullName: 'Sara Ali' }) {
  const supabase = {
    signInWithPassword: jest.fn().mockResolvedValue(session),
    verifyPhoneCode: jest.fn().mockResolvedValue(session),
    verify: jest.fn().mockResolvedValue(identity),
  };
  const people = {
    findByAuthUserId: jest.fn().mockResolvedValue(found),
    create: jest.fn().mockResolvedValue({ id: 'person-new' }),
    recordLogin: jest.fn().mockResolvedValue(undefined),
  };
  const consents = {
    recordForPerson: jest.fn().mockResolvedValue(undefined),
  };
  const transactions = {
    run: jest.fn((work: () => Promise<unknown>) => work()),
  };
  const orchestrator = new SignInOrchestrator(
    supabase as unknown as SupabaseAuthClient,
    people as unknown as PeopleService,
    consents as unknown as ConsentsService,
    transactions as unknown as TransactionManager,
  );
  return { supabase, people, consents, transactions, orchestrator };
}

describe('SignInOrchestrator', () => {
  describe('getting the session', () => {
    it('signs in with the phone and password', async () => {
      const { supabase, orchestrator } = setup();

      await orchestrator.execute(password);

      expect(supabase.signInWithPassword).toHaveBeenCalledWith(
        '+201012345678',
        'pw',
      );
      expect(supabase.verifyPhoneCode).not.toHaveBeenCalled();
    });

    it('confirms the phone with the code', async () => {
      const { supabase, orchestrator } = setup();

      await orchestrator.execute(code);

      expect(supabase.verifyPhoneCode).toHaveBeenCalledWith(
        '+201012345678',
        '482913',
      );
      expect(supabase.signInWithPassword).not.toHaveBeenCalled();
    });

    it('works out who signed in from the access token it got back', async () => {
      const { supabase, orchestrator } = setup();

      await orchestrator.execute(password);

      expect(supabase.verify).toHaveBeenCalledWith(session.accessToken);
    });
  });

  describe('a person who already exists', () => {
    it.each([password, code])(
      'records the login and returns the session, for $kind',
      async (credentials) => {
        const { people, orchestrator } = setup();

        await expect(orchestrator.execute(credentials)).resolves.toEqual({
          session,
          phoneRequired: false,
        });
        expect(people.findByAuthUserId).toHaveBeenCalledWith(
          identity.authUserId,
        );
        expect(people.recordLogin).toHaveBeenCalledTimes(1);
        expect(people.recordLogin).toHaveBeenCalledWith('person-1');
        expect(people.create).not.toHaveBeenCalled();
      },
    );
  });

  describe('a login with no person behind it yet', () => {
    it('creates the person from what the token says, then records the login', async () => {
      const { people, orchestrator } = setup(null);

      await expect(orchestrator.execute(code)).resolves.toEqual({
        session,
        phoneRequired: false,
      });
      expect(people.create).toHaveBeenCalledWith({
        phone: '+201012345678',
        fullName: 'Sara Ali',
        authUserId: identity.authUserId,
      });
      expect(people.recordLogin).toHaveBeenCalledWith('person-new');
    });

    it('records what was agreed at signup as the first consents of the new person', async () => {
      const { supabase, people, consents, orchestrator } = setup(null);
      supabase.verify.mockResolvedValue({
        ...identity,
        signupConsents: { termsVersion: 'v1', platformNotifications: true },
      });

      await orchestrator.execute(code);

      expect(people.create).toHaveBeenCalledTimes(1);
      expect(consents.recordForPerson).toHaveBeenCalledWith(
        'person-new',
        [
          { type: 'terms', granted: true },
          { type: 'privacy_policy', granted: true },
          { type: 'platform_notifications', granted: true },
        ],
        'signup',
      );
    });

    it('records no consents for a login that carries none, such as an existing one', async () => {
      const { consents, orchestrator } = setup(null);

      await orchestrator.execute(code);

      expect(consents.recordForPerson).not.toHaveBeenCalled();
    });

    it('passes on the email when the token has one', async () => {
      const { supabase, people, orchestrator } = setup(null);
      supabase.verify.mockResolvedValue({
        ...identity,
        email: 'sara@example.com',
      });

      await orchestrator.execute(code);

      expect(people.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'sara@example.com' }),
      );
    });

    it('uses the phone number as the name when none was given', async () => {
      const { supabase, people, orchestrator } = setup(null);
      supabase.verify.mockResolvedValue({
        authUserId: identity.authUserId,
        phone: '+201012345678',
      });

      await orchestrator.execute(code);

      expect(people.create).toHaveBeenCalledWith(
        expect.objectContaining({ fullName: '+201012345678' }),
      );
    });

    it('creates the person and records the login together or not at all', async () => {
      const { people, transactions, orchestrator } = setup(null);

      await orchestrator.execute(code);

      expect(transactions.run).toHaveBeenCalledTimes(1);
      expect(people.create).toHaveBeenCalledTimes(1);
      expect(people.recordLogin).toHaveBeenCalledTimes(1);
    });
  });

  describe('a login with no phone yet', () => {
    it('says a phone is needed, and creates and records nothing', async () => {
      const { supabase, people, orchestrator } = setup(null);
      supabase.verify.mockResolvedValue({ authUserId: identity.authUserId });

      await expect(orchestrator.execute(password)).resolves.toEqual({
        session,
        phoneRequired: true,
      });
      expect(people.create).not.toHaveBeenCalled();
      expect(people.recordLogin).not.toHaveBeenCalled();
    });
  });

  describe('when it fails', () => {
    it('creates and records nothing when the password is wrong', async () => {
      const { supabase, people, orchestrator } = setup();
      supabase.signInWithPassword.mockRejectedValue(
        new InvalidCredentialsException(),
      );

      await expect(orchestrator.execute(password)).rejects.toBeInstanceOf(
        InvalidCredentialsException,
      );
      expect(supabase.verify).not.toHaveBeenCalled();
      expect(people.recordLogin).not.toHaveBeenCalled();
    });

    it('creates and records nothing when the code is wrong', async () => {
      const { supabase, people, orchestrator } = setup(null);
      supabase.verifyPhoneCode.mockRejectedValue(
        new InvalidVerificationCodeException(),
      );

      await expect(orchestrator.execute(code)).rejects.toBeInstanceOf(
        InvalidVerificationCodeException,
      );
      expect(people.create).not.toHaveBeenCalled();
      expect(people.recordLogin).not.toHaveBeenCalled();
    });

    it('does not hand out the session when the person cannot be saved', async () => {
      const { people, orchestrator } = setup(null);
      people.create.mockRejectedValue(new Error('database down'));

      await expect(orchestrator.execute(code)).rejects.toThrow('database down');
    });
  });
});
