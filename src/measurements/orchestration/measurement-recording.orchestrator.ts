import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import type { MeasurementSource } from '../enums/measurement-source.enum';
import { MeasurementsQueryHandler } from '../handlers/measurements-query.handler';
import type { Reading } from '../interfaces/reading.interface';

/**
 * Takes over `MeasurementsService.record`. A reading belongs to a day, and the day is the one
 * the coach and client are in: Egypt's, not UTC's, or a reading taken after midnight at home
 * would land on yesterday. It joins the caller's transaction when there is one, so an intake
 * and its first readings are saved together or not at all.
 */
@Injectable()
export class MeasurementRecordingOrchestrator {
  private static readonly TIME_ZONE = 'Africa/Cairo';

  constructor(
    private readonly measurementsQuery: MeasurementsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(
    workspaceId: string,
    clientId: string,
    readings: Reading[],
    source: MeasurementSource,
  ): Promise<void> {
    if (readings.length === 0) {
      return;
    }
    await this.transactions.run(
      () =>
        this.measurementsQuery.upsertMany(
          workspaceId,
          clientId,
          readings,
          this.today(),
          source,
        ),
      { workspaceId },
    );
  }

  /** The date in Egypt as YYYY-MM-DD (the Canadian format happens to be that). */
  private today(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: MeasurementRecordingOrchestrator.TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }
}
