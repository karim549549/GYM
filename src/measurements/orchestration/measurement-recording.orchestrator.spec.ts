import type { TransactionManager } from '../../database/transaction.manager';
import { MeasurementSource } from '../enums/measurement-source.enum';
import type { MeasurementsQueryHandler } from '../handlers/measurements-query.handler';
import { MeasurementRecordingOrchestrator } from './measurement-recording.orchestrator';

const readings = [
  { metric: 'weight', value: 82.5, unit: 'kg' },
  { metric: 'height', value: 178, unit: 'cm' },
];

function setup() {
  const measurementsQuery = {
    upsertMany: jest.fn().mockResolvedValue(undefined),
  };
  const transactions = {
    run: jest.fn(async (work: () => Promise<unknown>) => work()),
  };
  const orchestrator = new MeasurementRecordingOrchestrator(
    measurementsQuery as unknown as MeasurementsQueryHandler,
    transactions as unknown as TransactionManager,
  );
  return { measurementsQuery, transactions, orchestrator };
}

describe('MeasurementRecordingOrchestrator', () => {
  afterEach(() => jest.useRealTimers());

  it('records the readings for the client, with where they came from', async () => {
    const { measurementsQuery, orchestrator } = setup();

    await orchestrator.execute('w1', 'c1', readings, MeasurementSource.INTAKE);

    expect(measurementsQuery.upsertMany).toHaveBeenCalledWith(
      'w1',
      'c1',
      readings,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      MeasurementSource.INTAKE,
    );
  });

  it('works inside the workspace’s own scope, in one transaction', async () => {
    const { transactions, orchestrator } = setup();

    await orchestrator.execute('w1', 'c1', readings, MeasurementSource.INTAKE);

    expect(transactions.run).toHaveBeenCalledTimes(1);
    expect(transactions.run).toHaveBeenCalledWith(expect.any(Function), {
      workspaceId: 'w1',
    });
  });

  it('dates the readings by the day it is in Egypt, not in UTC', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-26T22:30:00Z') });
    const { measurementsQuery, orchestrator } = setup();

    await orchestrator.execute('w1', 'c1', readings, MeasurementSource.INTAKE);

    // 22:30 UTC is already half past one in the morning of the 27th in Cairo
    expect(measurementsQuery.upsertMany.mock.calls[0][3]).toBe('2026-10-27');
  });

  it('keeps the same day for a reading taken in the Egyptian evening', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-26T17:00:00Z') });
    const { measurementsQuery, orchestrator } = setup();

    await orchestrator.execute('w1', 'c1', readings, MeasurementSource.INTAKE);

    expect(measurementsQuery.upsertMany.mock.calls[0][3]).toBe('2026-10-26');
  });

  it('uses winter time in winter', async () => {
    jest.useFakeTimers({ now: new Date('2026-12-31T22:30:00Z') });
    const { measurementsQuery, orchestrator } = setup();

    await orchestrator.execute('w1', 'c1', readings, MeasurementSource.INTAKE);

    expect(measurementsQuery.upsertMany.mock.calls[0][3]).toBe('2027-01-01');
  });

  it('does nothing when there is nothing to record', async () => {
    const { measurementsQuery, transactions, orchestrator } = setup();

    await orchestrator.execute('w1', 'c1', [], MeasurementSource.INTAKE);

    expect(measurementsQuery.upsertMany).not.toHaveBeenCalled();
    expect(transactions.run).not.toHaveBeenCalled();
  });

  it('lets a failure reach the caller', async () => {
    const { measurementsQuery, orchestrator } = setup();
    measurementsQuery.upsertMany.mockRejectedValue(new Error('database down'));

    await expect(
      orchestrator.execute('w1', 'c1', readings, MeasurementSource.INTAKE),
    ).rejects.toThrow('database down');
  });
});
