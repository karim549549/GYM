import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { MockWhatsAppClient } from './integrations/mock-whatsapp.client';
import { WhatsAppClient } from './whatsapp.client';
import { WhatsAppModule } from './whatsapp.module';

const compileWith = (provider: string) =>
  Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [() => ({ WHATSAPP_PROVIDER: provider })],
      }),
      WhatsAppModule,
    ],
  }).compile();

describe('WhatsAppModule', () => {
  it('provides the mock when the provider is mock', async () => {
    const moduleRef = await compileWith('mock');

    expect(moduleRef.get(WhatsAppClient)).toBeInstanceOf(MockWhatsAppClient);
  });

  it('shares one client with everything that asks for it', async () => {
    const moduleRef = await compileWith('mock');

    expect(moduleRef.get(WhatsAppClient)).toBe(moduleRef.get(WhatsAppClient));
  });

  it('refuses to start on meta until that client exists, instead of quietly sending nothing', async () => {
    await expect(compileWith('meta')).rejects.toThrow(/not.*implemented/i);
  });
});
