import { Logger } from '@nestjs/common';
import { MockWhatsAppClient } from '../../whatsapp/integrations/mock-whatsapp.client';
import { WhatsAppTemplate } from '../../whatsapp/enums/whatsapp-template.enum';
import { InvalidHookPayloadException } from '../exceptions/auth-exceptions';
import { VerificationCodeDeliveryOrchestrator } from './verification-code-delivery.orchestrator';

const payload = (
  phone: unknown = '+201012345678',
  otp: unknown = '482913',
) => ({
  user: { id: 'u1', phone, email: '' },
  sms: { otp },
});

function setup() {
  const whatsapp = new MockWhatsAppClient();
  return {
    whatsapp,
    orchestrator: new VerificationCodeDeliveryOrchestrator(whatsapp),
  };
}

describe('VerificationCodeDeliveryOrchestrator', () => {
  beforeAll(() => Logger.overrideLogger(false));

  it('sends the code to the phone as the verification template, in Arabic', async () => {
    const { whatsapp, orchestrator } = setup();

    await orchestrator.execute(payload());

    expect(whatsapp.outbox).toEqual([
      {
        to: '+201012345678',
        template: WhatsAppTemplate.VERIFICATION_CODE,
        language: 'ar',
        params: ['482913'],
      },
    ]);
  });

  it('adds the plus when Supabase leaves it off the number', async () => {
    const { whatsapp, orchestrator } = setup();

    await orchestrator.execute(payload('201012345678'));

    expect(whatsapp.outbox[0].to).toBe('+201012345678');
  });

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['a string', 'hello'],
    ['an empty object', {}],
    ['no sms', { user: { phone: '+201012345678' } }],
    ['no user', { sms: { otp: '482913' } }],
    ['no code', { user: { phone: '+201012345678' }, sms: {} }],
    ['no phone', { user: {}, sms: { otp: '482913' } }],
    ['a phone that is not a string', payload(201012345678)],
    ['a phone that is not a number', payload('call me')],
    ['an empty phone', payload('')],
    ['a code that is a number, not text', payload('+201012345678', 482913)],
    ['a code with letters', payload('+201012345678', '48a913')],
    ['an empty code', payload('+201012345678', '')],
  ])('refuses a call with %s and sends nothing', async (_label, body) => {
    const { whatsapp, orchestrator } = setup();

    await expect(orchestrator.execute(body)).rejects.toBeInstanceOf(
      InvalidHookPayloadException,
    );
    expect(whatsapp.outbox).toEqual([]);
  });

  it('keeps the code out of the error when the call is refused', async () => {
    const { orchestrator } = setup();

    const failure = await orchestrator
      .execute(payload('call me', '482913'))
      .catch((error: Error) => error);

    expect(JSON.stringify((failure as Error).message)).not.toContain('482913');
  });

  it('lets a delivery failure reach Supabase, so the person is told it did not go', async () => {
    const { whatsapp, orchestrator } = setup();
    jest
      .spyOn(whatsapp, 'sendTemplate')
      .mockRejectedValue(new Error('meta is down'));

    await expect(orchestrator.execute(payload())).rejects.toThrow(
      'meta is down',
    );
  });
});
