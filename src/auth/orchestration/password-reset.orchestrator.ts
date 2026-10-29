import { Injectable } from '@nestjs/common';
import { SupabaseAuthClient } from '../integrations/supabase-auth.client';

export interface PasswordReset {
  phone: string;
  code: string;
  newPassword: string;
}

/**
 * Takes over `AuthService.resetPassword`. A code proves the phone and nothing else: it
 * is spent on setting the new password and then every session of the person is ended,
 * including the temporary one the confirmation produced, so no token comes out of this
 * and anyone who had hold of an old session loses it.
 */
@Injectable()
export class PasswordResetOrchestrator {
  constructor(private readonly supabase: SupabaseAuthClient) {}

  async execute(reset: PasswordReset): Promise<void> {
    const session = await this.supabase.verifyPhoneCode(
      reset.phone,
      reset.code,
    );

    try {
      await this.supabase.updatePassword(
        session.accessToken,
        reset.newPassword,
      );
    } catch (error) {
      // the code is spent either way, so do not leave the session it produced alive
      await this.endEverySession(session.accessToken).catch(() => undefined);
      throw error;
    }
    await this.endEverySession(session.accessToken);
  }

  private endEverySession(accessToken: string): Promise<void> {
    return this.supabase.signOut(accessToken, 'global');
  }
}
