import { WhatsAppTemplate } from './enums/whatsapp-template.enum';
import type { WhatsAppTemplateMessage } from './interfaces/whatsapp-message.interface';
import { WhatsAppClient } from './whatsapp.client';

class RecordingClient extends WhatsAppClient {
  readonly delivered: WhatsAppTemplateMessage[] = [];

  protected async deliver(message: WhatsAppTemplateMessage): Promise<void> {
    this.delivered.push(message);
  }
}

const code = (
  overrides: Partial<WhatsAppTemplateMessage> = {},
): WhatsAppTemplateMessage => ({
  to: '+201012345678',
  template: WhatsAppTemplate.VERIFICATION_CODE,
  language: 'ar',
  params: ['482913'],
  ...overrides,
});

describe('WhatsAppClient', () => {
  it('hands a valid template message to the delivery', async () => {
    const client = new RecordingClient();

    await client.sendTemplate(code());

    expect(client.delivered).toEqual([code()]);
  });

  it.each([
    ['a local number', '01012345678'],
    ['a number with spaces', '+20 101 234 5678'],
    ['a number without the plus', '201012345678'],
    ['letters', 'not a number'],
    ['nothing', ''],
  ])('refuses %s as the recipient and delivers nothing', async (_label, to) => {
    const client = new RecordingClient();

    await expect(client.sendTemplate(code({ to }))).rejects.toThrow(
      /recipient/i,
    );
    expect(client.delivered).toEqual([]);
  });

  it.each([
    ['no parameters', []],
    ['too many parameters', ['482913', 'extra']],
    ['an empty parameter', ['']],
    ['a blank parameter', ['   ']],
  ])('refuses a verification code with %s', async (_label, params) => {
    const client = new RecordingClient();

    await expect(client.sendTemplate(code({ params }))).rejects.toThrow(
      /parameter/i,
    );
    expect(client.delivered).toEqual([]);
  });

  it('refuses a template it does not know', async () => {
    const client = new RecordingClient();

    await expect(
      client.sendTemplate(
        code({ template: 'made_up_template' as WhatsAppTemplate }),
      ),
    ).rejects.toThrow(/template/i);
    expect(client.delivered).toEqual([]);
  });

  it('keeps the code out of the error it throws', async () => {
    const client = new RecordingClient();

    const failure = await client
      .sendTemplate(code({ to: 'bad', params: ['482913'] }))
      .catch((error: Error) => error);

    expect((failure as Error).message).not.toContain('482913');
  });

  it('lets a delivery failure reach the caller', async () => {
    class FailingClient extends WhatsAppClient {
      protected async deliver(): Promise<void> {
        throw new Error('meta is down');
      }
    }

    await expect(new FailingClient().sendTemplate(code())).rejects.toThrow(
      'meta is down',
    );
  });
});
