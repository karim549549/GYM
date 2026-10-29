import { Injectable } from '@nestjs/common';
import type { MeasurementSource } from './enums/measurement-source.enum';
import type { MeasurementPoint } from './interfaces/measurement-point.interface';
import type { Reading } from './interfaces/reading.interface';
import { MeasurementRecordingOrchestrator } from './orchestration/measurement-recording.orchestrator';
import { MeasurementSeriesOrchestrator } from './orchestration/measurement-series.orchestrator';

/** The measurements module's interface: the numbers behind a client's charts. */
@Injectable()
export class MeasurementsService {
  constructor(
    private readonly measurementRecording: MeasurementRecordingOrchestrator,
    private readonly measurementSeries: MeasurementSeriesOrchestrator,
  ) {}

  /** Every reading of one client, oldest first, for their charts. */
  seriesOf(workspaceId: string, clientId: string): Promise<MeasurementPoint[]> {
    return this.measurementSeries.execute(workspaceId, clientId);
  }

  /** Records today's readings; one already taken today for the same metric is replaced. */
  record(
    workspaceId: string,
    clientId: string,
    readings: Reading[],
    source: MeasurementSource,
  ): Promise<void> {
    return this.measurementRecording.execute(
      workspaceId,
      clientId,
      readings,
      source,
    );
  }
}
