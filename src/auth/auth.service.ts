import { Injectable } from '@nestjs/common';
import { ConsentsService } from '../consents/consents.service';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { LoginDto } from './dto/login.dto';
import type { RefreshDto } from './dto/refresh.dto';
import type { RegisterDto } from './dto/register.dto';
import type { ResendDto } from './dto/resend.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import type { VerifyDto } from './dto/verify.dto';
import { SupabaseAuthClient } from './integrations/supabase-auth.client';
import type { AuthSession } from './interfaces/auth-session.interface';
import type { MeResponse } from './interfaces/me-response.interface';
import type { Principal } from './interfaces/principal.interface';
import type { SignInResult } from './interfaces/sign-in.interface';
import type { VerifiedIdentity } from './interfaces/verified-identity.interface';
import { PasswordResetOrchestrator } from './orchestration/password-reset.orchestrator';
import { PrincipalResolutionOrchestrator } from './orchestration/principal-resolution.orchestrator';
import { SignInOrchestrator } from './orchestration/sign-in.orchestrator';
import { VerificationCodeDeliveryOrchestrator } from './orchestration/verification-code-delivery.orchestrator';

/** The auth module's single interface; the work is delegated to orchestrators or the identity provider's client. */
@Injectable()
export class AuthService {
  constructor(
    private readonly supabase: SupabaseAuthClient,
    private readonly consents: ConsentsService,
    private readonly signIn: SignInOrchestrator,
    private readonly principalResolution: PrincipalResolutionOrchestrator,
    private readonly codeDelivery: VerificationCodeDeliveryOrchestrator,
    private readonly passwordReset: PasswordResetOrchestrator,
  ) {}

  /** Creates the login and sends a code to the phone. The person exists only after the code is confirmed. */
  register(dto: RegisterDto): Promise<void> {
    return this.supabase.signUp(dto.phone, dto.password, dto.fullName, {
      termsVersion: this.consents.texts().version,
      platformNotifications: dto.platformNotifications ?? false,
    });
  }

  verify(dto: VerifyDto): Promise<SignInResult> {
    return this.signIn.execute({
      kind: 'phone_code',
      phone: dto.phone,
      code: dto.code,
    });
  }

  resend(dto: ResendDto): Promise<void> {
    return this.supabase.resendPhoneCode(dto.phone);
  }

  login(dto: LoginDto): Promise<SignInResult> {
    return this.signIn.execute({
      kind: 'password',
      phone: dto.phone,
      password: dto.password,
    });
  }

  /** Sends a code to the phone if it has an account. The answer is the same either way. */
  forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    return this.supabase.sendPhoneCode(dto.phone);
  }

  resetPassword(dto: ResetPasswordDto): Promise<void> {
    return this.passwordReset.execute(dto);
  }

  refresh(dto: RefreshDto): Promise<AuthSession> {
    return this.supabase.refreshSession(dto.refreshToken);
  }

  logout(accessToken: string): Promise<void> {
    return this.supabase.signOut(accessToken);
  }

  /** Ends the person's sessions on every device, this one included. */
  logoutEverywhere(accessToken: string): Promise<void> {
    return this.supabase.signOut(accessToken, 'global');
  }

  /** Supabase made a verification code; deliver it over WhatsApp. */
  deliverVerificationCode(payload: unknown): Promise<void> {
    return this.codeDelivery.execute(payload);
  }

  resolvePrincipal(
    identity: VerifiedIdentity,
    requestedWorkspaceId?: string,
  ): Promise<Principal | undefined> {
    return this.principalResolution.execute(identity, requestedWorkspaceId);
  }

  describe(principal: Principal): MeResponse {
    return {
      personId: principal.personId,
      fullName: principal.fullName,
      workspaces: principal.memberships,
      ...(principal.workspaceId && {
        activeWorkspaceId: principal.workspaceId,
      }),
      ...(principal.role && { role: principal.role }),
      ...(principal.isOwner !== undefined && { isOwner: principal.isOwner }),
    };
  }
}
