import { Injectable } from '@nestjs/common';
import { ConsentsService } from '../../consents/consents.service';
import { ConsentSource } from '../../consents/enums/consent-source.enum';
import { PersonConsentType } from '../../consents/enums/person-consent-type.enum';
import { TransactionManager } from '../../database/transaction.manager';
import { PeopleService } from '../../people/people.service';
import { SupabaseAuthClient } from '../integrations/supabase-auth.client';
import type { AuthSession } from '../interfaces/auth-session.interface';
import type {
  SignInCredentials,
  SignInResult,
} from '../interfaces/sign-in.interface';
import type { VerifiedIdentity } from '../interfaces/verified-identity.interface';

/**
 * Takes over every way of obtaining a session. However the session was earned (the
 * password, the code that confirms a phone), the ending is the same: make sure the
 * person exists, record the login, and say whether a phone is still missing.
 *
 * A person is created here, the first time a login with a verified phone is seen, and
 * never before: until the code is confirmed nothing of theirs is in our database.
 */
@Injectable()
export class SignInOrchestrator {
  constructor(
    private readonly supabase: SupabaseAuthClient,
    private readonly people: PeopleService,
    private readonly consents: ConsentsService,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(credentials: SignInCredentials): Promise<SignInResult> {
    const session = await this.obtainSession(credentials);
    const identity = await this.supabase.verify(session.accessToken);
    const phoneRequired = await this.completeLogin(identity);
    return { session, phoneRequired };
  }

  private obtainSession(credentials: SignInCredentials): Promise<AuthSession> {
    switch (credentials.kind) {
      case 'password':
        return this.supabase.signInWithPassword(
          credentials.phone,
          credentials.password,
        );
      case 'phone_code':
        return this.supabase.verifyPhoneCode(
          credentials.phone,
          credentials.code,
        );
    }
  }

  /** Returns whether a phone is still required. */
  private completeLogin(identity: VerifiedIdentity): Promise<boolean> {
    return this.transactions.run(async () => {
      const existing = await this.people.findByAuthUserId(identity.authUserId);
      if (existing) {
        await this.people.recordLogin(existing.id);
        return false;
      }
      if (!identity.phone) {
        return true;
      }

      const created = await this.people.create({
        phone: identity.phone,
        fullName: identity.fullName ?? identity.phone,
        authUserId: identity.authUserId,
        ...(identity.email && { email: identity.email }),
      });
      await this.recordSignupConsents(created.id, identity);
      await this.people.recordLogin(created.id);
      return false;
    });
  }

  /** What was agreed at signup becomes the person's first consents, the day the person comes to exist. */
  private async recordSignupConsents(
    personId: string,
    identity: VerifiedIdentity,
  ): Promise<void> {
    if (!identity.signupConsents) {
      return;
    }
    await this.consents.recordForPerson(
      personId,
      [
        { type: PersonConsentType.TERMS, granted: true },
        { type: PersonConsentType.PRIVACY_POLICY, granted: true },
        {
          type: PersonConsentType.PLATFORM_NOTIFICATIONS,
          granted: identity.signupConsents.platformNotifications,
        },
      ],
      ConsentSource.SIGNUP,
    );
  }
}
