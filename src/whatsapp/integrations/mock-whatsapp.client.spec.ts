import { Logger } from '@nestjs/common';
import { WhatsAppTemplate } from '../enums/whatsapp-template.enum';
import type { WhatsAppTemplateMessage } from '../interfaces/whatsapp-message.interface';
import { MockWhatsAppClient } from './mock-whatsapp.client';

const message = (to: string, code: string): WhatsAppTemplateMessage => ({
  to,
  template: WhatsAppTemplate.VERIFICATION_CODE,
  language: 'ar',
  params: [code],
});

describe('MockWhatsAppClient', () => {
  beforeAll(() => Logger.overrideLogger(false));

  it('records what would have been sent, in order', async () => {
    const client = new MockWhatsAppClient();

    await client.sendTemplate(message('+201000000001', '111111'));
    await client.sendTemplate(message('+201000000002', '222222'));

    expect(client.outbox).toEqual([
      message('+201000000001', '111111'),
      message('+201000000002', '222222'),
    ]);
  });

  it('finds the latest message to a number', async () => {
    const client = new MockWhatsAppClient();
    await client.sendTemplate(message('+201000000001', '111111'));
    await client.sendTemplate(message('+201000000002', '222222'));
    await client.sendTemplate(message('+201000000001', '333333'));

    expect(client.lastTo('+201000000001')?.params).toEqual(['333333']);
    expect(client.lastTo('+201099999999')).toBeUndefined();
  });

  it('refuses what the real client would refuse, and records nothing', async () => {
    const client = new MockWhatsAppClient();

    await expect(
      client.sendTemplate(message('01012345678', '111111')),
    ).rejects.toThrow(/recipient/i);
    expect(client.outbox).toEqual([]);
  });

  it('cannot be changed through what it hands out', async () => {
    const client = new MockWhatsAppClient();
    await client.sendTemplate(message('+201000000001', '111111'));

    client.outbox.length = 0;
    client.outbox.push(message('+201000000009', '999999'));

    expect(client.outbox).toEqual([message('+201000000001', '111111')]);
  });

  it('forgets everything on clear', async () => {
    const client = new MockWhatsAppClient();
    await client.sendTemplate(message('+201000000001', '111111'));

    client.clear();

    expect(client.outbox).toEqual([]);
  });

  it('keeps each instance separate', async () => {
    const first = new MockWhatsAppClient();
    const second = new MockWhatsAppClient();

    await first.sendTemplate(message('+201000000001', '111111'));

    expect(second.outbox).toEqual([]);
  });
});
