import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { CurrentHookPayload } from '../common/decorators/current-hook-payload.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { SupabaseHookGuard } from './guards/supabase-hook.guard';

/** Calls Supabase makes to us. They carry a signature, not a user token. */
@Controller('auth/hooks')
export class AuthHooksController {
  constructor(private readonly auth: AuthService) {}

  /** Supabase made a verification code and asks us to deliver it. */
  @Public()
  @UseGuards(SupabaseHookGuard)
  @Post('send-sms')
  @HttpCode(200)
  async sendSms(
    @CurrentHookPayload() payload: unknown,
  ): Promise<Record<string, never>> {
    await this.auth.deliverVerificationCode(payload);
    return {};
  }
}
