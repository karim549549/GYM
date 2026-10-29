import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { MeasurementsQueryHandler } from '../handlers/measurements-query.handler';
import type { MeasurementPoint } from '../interfaces/measurement-point.interface';

/** Takes over `MeasurementsService.seriesOf`: every reading of one client, oldest first. */
@Injectable()
export class MeasurementSeriesOrchestrator {
  constructor(
    private readonly measurementsQuery: MeasurementsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(workspaceId: string, clientId: string): Promise<MeasurementPoint[]> {
    return this.transactions.run(
      () => this.measurementsQuery.seriesOf(clientId),
      { workspaceId },
    );
  }
}
