import type { ClientsService } from '../../clients/clients.service';
import type { ConsentsService } from '../../consents/consents.service';
import type { TransactionManager } from '../../database/transaction.manager';
import type { WhatsAppClient } from '../../whatsapp/whatsapp.client';
import type { WorkspacesService } from '../../workspaces/workspaces.service';
import { ReminderAudience } from '../enums/reminder-audience.enum';
import { ReminderKind } from '../enums/reminder-kind.enum';
import type { RemindersQueryHandler } from '../handlers/reminders-query.handler';
import type { ClaimedReminder } from '../interfaces/reminder.interface';
import { ReminderDispatchOrchestrator } from './reminder-dispatch.orchestrator';

function setup() {
  const reminders: ClaimedReminder[] = ['first', 'second'].map((id) => ({
    id,
    workspaceId: 'workspace',
    clientId: id,
    kind: ReminderKind.EXPIRING_SOON,
    audience: ReminderAudience.CLIENT,
    payload: { endsOn: '2026-11-01' },
  }));
  const query = {
    claimDue: jest.fn().mockResolvedValue(reminders),
    markFailed: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
  };
  const whatsapp = {
    sendTemplate: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
  };
  const orchestrator = new ReminderDispatchOrchestrator(
    query as unknown as RemindersQueryHandler,
    {
      findOne: jest
        .fn()
        .mockResolvedValue({ phone: '+201000000000', fullName: 'Test' }),
    } as unknown as ClientsService,
    {
      findCurrent: jest.fn().mockResolvedValue({ brandName: 'Test' }),
    } as unknown as WorkspacesService,
    whatsapp as unknown as WhatsAppClient,
    {
      isGranted: jest.fn().mockResolvedValue(true),
    } as unknown as ConsentsService,
    {
      run: <T>(work: () => Promise<T>) => work(),
    } as unknown as TransactionManager,
  );
  return { query, whatsapp, orchestrator };
}

describe('ReminderDispatchOrchestrator sequencing', () => {
  it('records a failed delivery before starting the next one and counts only successes', async () => {
    const { query, whatsapp, orchestrator } = setup();
    let finishMark!: () => void;
    let markStarted!: () => void;
    const marking = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    whatsapp.sendTemplate.mockRejectedValueOnce(
      new Error('provider unavailable'),
    );
    query.markFailed.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishMark = resolve;
          markStarted();
        }),
    );

    const dispatch = orchestrator.execute();
    await marking;
    expect(whatsapp.sendTemplate).toHaveBeenCalledTimes(1);
    expect(query.markFailed).toHaveBeenCalledWith('first', 'send_failed');
    finishMark();
    await expect(dispatch).resolves.toBe(1);
    expect(whatsapp.sendTemplate).toHaveBeenCalledTimes(2);
  });

  it('stops before the next delivery after lease loss', async () => {
    const { whatsapp, orchestrator } = setup();
    const controller = new AbortController();
    const lostLease = new Error('lease lost');
    whatsapp.sendTemplate.mockImplementationOnce(async () => {
      controller.abort(lostLease);
    });
    await expect(orchestrator.execute(controller.signal)).rejects.toBe(
      lostLease,
    );
    expect(whatsapp.sendTemplate).toHaveBeenCalledTimes(1);
  });

  it('returns zero for an empty batch', async () => {
    const { query, whatsapp, orchestrator } = setup();
    query.claimDue.mockResolvedValueOnce([]);
    await expect(orchestrator.execute()).resolves.toBe(0);
    expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
  });
});
