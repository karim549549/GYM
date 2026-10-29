import { Injectable } from '@nestjs/common';
import { isNumberString, isString } from 'class-validator';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { WhatsAppTemplate } from '../../whatsapp/enums/whatsapp-template.enum';
import { WhatsAppClient } from '../../whatsapp/whatsapp.client';
import { InvalidHookPayloadException } from '../exceptions/auth-exceptions';

/**
 * Supabase makes and keeps every verification code; this only delivers it. Supabase calls
 * the Send SMS hook (a signed request, see \`SupabaseHookGuard\`) with the phone and the
 * code, and the code goes out over WhatsApp. A failure is allowed to reach Supabase as an
 * error, which is how the person is told the code did not go.
 */
@Injectable()
export class VerificationCodeDeliveryOrchestrator {
  constructor(private readonly whatsapp: WhatsAppClient) {}

  async execute(payload: unknown): Promise<void> {
    const { to, code } = this.read(payload);
    await this.whatsapp.sendTemplate({
      to,
      template: WhatsAppTemplate.VERIFICATION_CODE,
      language: 'ar',
      params: [code],
    });
  }

  /** The signature proves who sent it, not that it has the shape we expect. */
  private read(payload: unknown): { to: string; code: string } {
    const body = payload as
      | { user?: { phone?: unknown }; sms?: { otp?: unknown } }
      | undefined
      | null;
    const phone = body?.user?.phone;
    const otp = body?.sms?.otp;
    if (
      !isString(phone) ||
      !isString(otp) ||
      !isNumberString(otp, { no_symbols: true })
    ) {
      throw new InvalidHookPayloadException();
    }

    // Supabase may leave the plus off; the parser needs it to know the country code
    const to = parsePhoneNumberFromString(
      phone.startsWith('+') ? phone : `+${phone}`,
    )?.number;
    if (!to) {
      throw new InvalidHookPayloadException();
    }
    return { to, code: otp };
  }
}
