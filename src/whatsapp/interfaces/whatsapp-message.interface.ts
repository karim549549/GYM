import type { WhatsAppTemplate } from '../enums/whatsapp-template.enum';

export interface WhatsAppTemplateMessage {
  /** Recipient in international format, for example +201012345678. */
  to: string;
  template: WhatsAppTemplate;
  language: 'ar' | 'en';
  /** Values for the template's placeholders, in order. */
  params: string[];
}
