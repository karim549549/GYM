import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import { MockWhatsAppClient } from './integrations/mock-whatsapp.client';
import { WhatsAppClient } from './whatsapp.client';

/** WhatsApp messaging. `WHATSAPP_PROVIDER` picks the client; callers only know `WhatsAppClient`. */
@Module({
  providers: [
    {
      provide: WhatsAppClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): WhatsAppClient => {
        const provider = config.get('WHATSAPP_PROVIDER', { infer: true });
        if (provider === 'meta') {
          // failing here is deliberate: starting up and quietly sending nothing is worse
          throw new Error('The Meta WhatsApp client is not implemented yet');
        }
        return new MockWhatsAppClient();
      },
    },
  ],
  exports: [WhatsAppClient],
})
export class WhatsAppModule {}
