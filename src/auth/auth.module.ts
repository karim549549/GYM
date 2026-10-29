import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MembersModule } from '../members/members.module';
import { ConsentsModule } from '../consents/consents.module';
import { PeopleModule } from '../people/people.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { AuthController } from './auth.controller';
import { AuthHooksController } from './auth-hooks.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { WorkspaceActionGuard } from './guards/workspace-action.guard';
import { SupabaseHookGuard } from './guards/supabase-hook.guard';
import { SupabaseAuthClient } from './integrations/supabase-auth.client';
import { PasswordResetOrchestrator } from './orchestration/password-reset.orchestrator';
import { PrincipalResolutionOrchestrator } from './orchestration/principal-resolution.orchestrator';
import { SignInOrchestrator } from './orchestration/sign-in.orchestrator';
import { VerificationCodeDeliveryOrchestrator } from './orchestration/verification-code-delivery.orchestrator';
import { WorkspaceSelectionPolicy } from './policies/workspace-selection.policy';

@Module({
  imports: [ConsentsModule, PeopleModule, MembersModule, WhatsAppModule],
  controllers: [AuthController, AuthHooksController],
  providers: [
    AuthService,
    SignInOrchestrator,
    PasswordResetOrchestrator,
    VerificationCodeDeliveryOrchestrator,
    SupabaseHookGuard,
    PrincipalResolutionOrchestrator,
    WorkspaceSelectionPolicy,
    SupabaseAuthClient,
    { provide: APP_GUARD, useClass: AuthGuard },
    // after the one above, which is what puts the principal on the request
    { provide: APP_GUARD, useClass: WorkspaceActionGuard },
  ],
})
export class AuthModule {}
