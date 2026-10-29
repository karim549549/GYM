import { Logger } from '@nestjs/common';
import type { WhatsAppTemplateMessage } from '../interfaces/whatsapp-message.interface';
import { WhatsAppClient } from '../whatsapp.client';

/**
 * Stands in for Meta in development and tests: it keeps what would have been sent and
 * prints it to the console, so a verification code can be read and typed back in. That
 * is the one place a code or number is logged on purpose, which is why the environment
 * check refuses this client in production.
 */
export class MockWhatsAppClient extends WhatsAppClient {
  private readonly logger = new Logger(MockWhatsAppClient.name);
  private readonly sent: WhatsAppTemplateMessage[] = [];

  /** A copy, oldest first. */
  get outbox(): WhatsAppTemplateMessage[] {
    return structuredClone(this.sent);
  }

  lastTo(recipient: string): WhatsAppTemplateMessage | undefined {
    return this.outbox.reverse().find((message) => message.to === recipient);
  }

  clear(): void {
    this.sent.length = 0;
  }

  protected async deliver(message: WhatsAppTemplateMessage): Promise<void> {
    this.sent.push(structuredClone(message));
    this.logger.log(
      `(mock) ${message.template} to ${message.to}: ${message.params.join(', ')}`,
    );
  }
}
