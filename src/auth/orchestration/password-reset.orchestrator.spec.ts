import {
  AuthProviderUnavailableException,
  InvalidVerificationCodeException,
  WeakPasswordException,
} from '../exceptions/auth-exceptions';
import type { SupabaseAuthClient } from '../integrations/supabase-auth.client';
import type { AuthSession } from '../interfaces/auth-session.interface';
import { PasswordResetOrchestrator } from './password-reset.orchestrator';

const session: AuthSession = {
  accessToken: 'temporary-access',
  refreshToken: 'temporary-refresh',
  expiresIn: 3600,
  tokenType: 'bearer',
};
const reset = {
  phone: '+201012345678',
  code: '482913',
  newPassword: 'a-brand-new-password',
};

function setup() {
  const order: string[] = [];
  const supabase = {
    verifyPhoneCode: jest.fn(async () => {
      order.push('verify');
      return session;
    }),
    updatePassword: jest.fn(async () => {
      order.push('update');
    }),
    signOut: jest.fn(async () => {
      order.push('sign out');
    }),
  };
  const orchestrator = new PasswordResetOrchestrator(
    supabase as unknown as SupabaseAuthClient,
  );
  return { supabase, orchestrator, order };
}

describe('PasswordResetOrchestrator', () => {
  it('confirms the code, sets the new password, then ends every session', async () => {
    const { supabase, orchestrator, order } = setup();

    await expect(orchestrator.execute(reset)).resolves.toBeUndefined();

    expect(order).toEqual(['verify', 'update', 'sign out']);
    expect(supabase.verifyPhoneCode).toHaveBeenCalledWith(
      '+201012345678',
      '482913',
    );
    expect(supabase.updatePassword).toHaveBeenCalledWith(
      'temporary-access',
      'a-brand-new-password',
    );
    expect(supabase.signOut).toHaveBeenCalledWith('temporary-access', 'global');
  });

  it('hands back no session: a code proves the phone, it never signs anyone in', async () => {
    const { orchestrator } = setup();

    expect(await orchestrator.execute(reset)).toBeUndefined();
  });

  it('changes nothing when the code is wrong', async () => {
    const { supabase, orchestrator } = setup();
    supabase.verifyPhoneCode.mockRejectedValue(
      new InvalidVerificationCodeException(),
    );

    await expect(orchestrator.execute(reset)).rejects.toBeInstanceOf(
      InvalidVerificationCodeException,
    );
    expect(supabase.updatePassword).not.toHaveBeenCalled();
    expect(supabase.signOut).not.toHaveBeenCalled();
  });

  it('does not leave the temporary session alive when the password is refused', async () => {
    const { supabase, orchestrator } = setup();
    supabase.updatePassword.mockRejectedValue(new WeakPasswordException());

    await expect(orchestrator.execute(reset)).rejects.toBeInstanceOf(
      WeakPasswordException,
    );
    expect(supabase.signOut).toHaveBeenCalledWith('temporary-access', 'global');
  });

  it('still reports why the password was refused when ending the session also fails', async () => {
    const { supabase, orchestrator } = setup();
    supabase.updatePassword.mockRejectedValue(new WeakPasswordException());
    supabase.signOut.mockRejectedValue(new AuthProviderUnavailableException());

    await expect(orchestrator.execute(reset)).rejects.toBeInstanceOf(
      WeakPasswordException,
    );
  });

  it('reports a failure to end the sessions after the password was set, since stolen sessions may live on', async () => {
    const { supabase, orchestrator } = setup();
    supabase.signOut.mockRejectedValue(new AuthProviderUnavailableException());

    await expect(orchestrator.execute(reset)).rejects.toBeInstanceOf(
      AuthProviderUnavailableException,
    );
  });
});
