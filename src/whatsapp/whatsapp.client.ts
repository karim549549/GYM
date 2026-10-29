import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { WhatsAppTemplate } from './enums/whatsapp-template.enum';
import type { WhatsAppTemplateMessage } from './interfaces/whatsapp-message.interface';

/**
 * The one way this backend sends a WhatsApp message. Every implementation (the mock and,
 * later, Meta's Cloud API) shares the checks below, so a message the real thing would
 * refuse is refused in development too. Errors never repeat the parameters: they can be
 * a verification code.
 */
export abstract class WhatsAppClient {
  // how many placeholders each approved template has
  private static readonly PARAMETER_COUNTS: Record<WhatsAppTemplate, number> = {
    [WhatsAppTemplate.VERIFICATION_CODE]: 1,
    [WhatsAppTemplate.SUBSCRIPTION_EXPIRING]: 3,
    [WhatsAppTemplate.SUBSCRIPTION_EXPIRED]: 3,
    [WhatsAppTemplate.CHECKIN_DUE]: 3,
  };

  async sendTemplate(message: WhatsAppTemplateMessage): Promise<void> {
    this.assertValid(message);
    await this.deliver(message);
  }

  protected abstract deliver(message: WhatsAppTemplateMessage): Promise<void>;

  private assertValid(message: WhatsAppTemplateMessage): void {
    // the parsed number equals the input only when it is already international format
    if (parsePhoneNumberFromString(message.to)?.number !== message.to) {
      throw new Error(
        'Invalid WhatsApp recipient: use +<country code><number>',
      );
    }

    const expected = WhatsAppClient.PARAMETER_COUNTS[message.template];
    if (expected === undefined) {
      throw new Error(`Unknown WhatsApp template: ${message.template}`);
    }
    if (message.params.length !== expected) {
      throw new Error(
        `WhatsApp template ${message.template} takes ${expected} parameter(s)`,
      );
    }
    if (message.params.some((param) => param.trim() === '')) {
      throw new Error('WhatsApp template parameters must not be blank');
    }
  }
}
