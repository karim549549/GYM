import { Injectable } from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';
import { BaseQueryHandler } from '../../common/handlers/base-query.handler';
import { measurements } from '../../database/schema';
import type { MeasurementSource } from '../enums/measurement-source.enum';
import type { MeasurementPoint } from '../interfaces/measurement-point.interface';
import type { Reading } from '../interfaces/reading.interface';

/** Data access for the `measurements` table. Row level security keeps it to one workspace. */
@Injectable()
export class MeasurementsQueryHandler extends BaseQueryHandler {
  /** Every reading of a client, oldest first: the numbers behind their charts. */
  async seriesOf(clientId: string): Promise<MeasurementPoint[]> {
    return this.db
      .select({
        metric: measurements.metric,
        unit: measurements.unit,
        value: measurements.value,
        date: measurements.measuredAt,
      })
      .from(measurements)
      .where(eq(measurements.clientId, clientId))
      .orderBy(asc(measurements.measuredAt));
  }

  /**
   * A metric is measured once a day, so a reading that already exists for that day is
   * replaced rather than added: submitting a check-in again corrects the chart.
   */
  async upsertMany(
    workspaceId: string,
    clientId: string,
    readings: Reading[],
    measuredAt: string,
    source: MeasurementSource,
  ): Promise<void> {
    await this.db
      .insert(measurements)
      .values(
        readings.map((reading) => ({
          workspaceId,
          clientId,
          measuredAt,
          source,
          ...reading,
        })),
      )
      .onConflictDoUpdate({
        target: [
          measurements.clientId,
          measurements.metric,
          measurements.measuredAt,
        ],
        set: {
          value: sql`excluded.value`,
          unit: sql`excluded.unit`,
          source: sql`excluded.source`,
        },
      });
  }
}
