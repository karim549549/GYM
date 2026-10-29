import { ConfigService } from '@nestjs/config';
import { InMemoryLockStore, LocksStorage } from '@nestjs/locks';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test, type TestingModule } from '@nestjs/testing';
import { CheckinTopUpJob } from '../checkins/jobs/checkin-top-up.job';
import { CheckinsService } from '../checkins/checkins.service';
import { ReminderDispatchJob } from '../reminders/jobs/reminder-dispatch.job';
import { RemindersService } from '../reminders/reminders.service';
import { SchedulingModule } from './scheduling.module';

describe('Scheduled feature jobs', () => {
  const modules: TestingModule[] = [];
  let sharedStore: InMemoryLockStore;

  beforeEach(() => {
    jest.useFakeTimers();
    sharedStore = new InMemoryLockStore();
  });

  afterEach(async () => {
    await Promise.all(modules.splice(0).map((moduleRef) => moduleRef.close()));
    jest.useRealTimers();
  });

  async function start(reminderSeconds = 60, checkinSeconds = 3600) {
    const reminders = {
      dispatchDue: jest
        .fn<Promise<number>, [signal?: AbortSignal]>()
        .mockResolvedValue(0),
    };
    const checkins = {
      topUp: jest
        .fn<Promise<number>, [signal?: AbortSignal]>()
        .mockResolvedValue(0),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [SchedulingModule],
      providers: [
        ReminderDispatchJob,
        CheckinTopUpJob,
        { provide: RemindersService, useValue: reminders },
        { provide: CheckinsService, useValue: checkins },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'REMINDER_POLL_SECONDS'
                ? reminderSeconds
                : checkinSeconds,
          },
        },
        {
          provide: 'TEST_LOCK_STORE',
          inject: [LocksStorage],
          useFactory: (storage: LocksStorage) => {
            storage.registerSource(sharedStore);
            return sharedStore;
          },
        },
      ],
    }).compile();
    modules.push(moduleRef);
    moduleRef.useLogger(false);
    await moduleRef.init();
    await jest.advanceTimersByTimeAsync(0);
    return { moduleRef, reminders, checkins };
  }

  it('keeps startup behavior and configurable intervals', async () => {
    const app = await start(7, 11);
    expect(app.checkins.topUp).toHaveBeenCalledTimes(1);
    expect(app.reminders.dispatchDue).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(7000);
    expect(app.reminders.dispatchDue).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(4000);
    expect(app.checkins.topUp).toHaveBeenCalledTimes(2);
  });

  it('registers no timers and takes no locks when disabled', async () => {
    const app = await start(0, 0);
    expect(app.moduleRef.get(SchedulerRegistry).getIntervals()).toEqual([]);
    await jest.advanceTimersByTimeAsync(3_600_000);
    expect(app.checkins.topUp).not.toHaveBeenCalled();
    expect(app.reminders.dispatchDue).not.toHaveBeenCalled();
    expect(sharedStore.peek('checkins:top-up:owner')).toBeUndefined();
  });

  it('runs each job on only one of two application instances', async () => {
    const first = await start();
    const second = await start();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(
      first.checkins.topUp.mock.calls.length +
        second.checkins.topUp.mock.calls.length,
    ).toBe(1);
    expect(
      first.reminders.dispatchDue.mock.calls.length +
        second.reminders.dispatchDue.mock.calls.length,
    ).toBe(1);
  });

  it('skips overlapping runs, then continues after a failure', async () => {
    const app = await start(1, 0);
    let rejectRun!: (reason: Error) => void;
    app.reminders.dispatchDue.mockImplementationOnce(
      () =>
        new Promise<number>((_, reject) => {
          rejectRun = reject;
        }),
    );
    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(2000);
    expect(app.reminders.dispatchDue).toHaveBeenCalledTimes(1);
    rejectRun(new Error('failure'));
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(1000);
    expect(app.reminders.dispatchDue).toHaveBeenCalledTimes(2);
  });

  it('stops callbacks on shutdown and hands ownership to another instance', async () => {
    const first = await start(1, 0);
    const second = await start(1, 0);
    await jest.advanceTimersByTimeAsync(1500);
    expect(first.reminders.dispatchDue).toHaveBeenCalledTimes(1);
    await first.moduleRef.close();
    modules.splice(modules.indexOf(first.moduleRef), 1);
    await jest.advanceTimersByTimeAsync(2000);
    expect(first.reminders.dispatchDue).toHaveBeenCalledTimes(1);
    expect(second.reminders.dispatchDue).toHaveBeenCalled();
  });

  it('waits for an active job before completing shutdown', async () => {
    const app = await start(1, 0);
    let finish!: (value: number) => void;
    app.reminders.dispatchDue.mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          finish = resolve;
        }),
    );
    await jest.advanceTimersByTimeAsync(1000);
    let closed = false;
    const closing = app.moduleRef.close().then(() => {
      closed = true;
    });
    await jest.advanceTimersByTimeAsync(100);
    expect(closed).toBe(false);
    finish(0);
    await closing;
    modules.splice(modules.indexOf(app.moduleRef), 1);
    expect(closed).toBe(true);
  });

  it('passes an aborted signal to ongoing work when its lease is lost', async () => {
    const app = await start(1, 0);
    let finish!: (value: number) => void;
    app.reminders.dispatchDue.mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          finish = resolve;
        }),
    );
    await jest.advanceTimersByTimeAsync(1000);
    const signal = app.reminders.dispatchDue.mock.calls[0][0];
    expect(signal?.aborted).toBe(false);
    jest.spyOn(sharedStore, 'renew').mockResolvedValue(false);
    await jest.advanceTimersByTimeAsync(10_000);
    expect(signal?.aborted).toBe(true);
    finish(0);
    await jest.advanceTimersByTimeAsync(0);
  });
});
