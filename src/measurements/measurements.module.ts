import { Module } from '@nestjs/common';
import { MeasurementsQueryHandler } from './handlers/measurements-query.handler';
import { MeasurementsService } from './measurements.service';
import { MeasurementSeriesOrchestrator } from './orchestration/measurement-series.orchestrator';
import { MeasurementRecordingOrchestrator } from './orchestration/measurement-recording.orchestrator';

@Module({
  providers: [
    MeasurementsService,
    MeasurementsQueryHandler,
    MeasurementRecordingOrchestrator,
    MeasurementSeriesOrchestrator,
  ],
  exports: [MeasurementsService],
})
export class MeasurementsModule {}
