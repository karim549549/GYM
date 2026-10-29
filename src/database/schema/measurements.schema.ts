import { sql } from 'drizzle-orm';
import {
  check,
  date,
  foreignKey,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { MeasurementSource } from '../../measurements/enums/measurement-source.enum';
import { clients } from './clients.schema';
import { workspaces } from './workspaces.schema';

// the allowed values are the enum's, so the constraint cannot drift from the code
const SOURCE_VALUES = Object.values(MeasurementSource)
  .map((source) => `'${source}'`)
  .join(', ');

/**
 * One number about one client on one day, in long format: a new metric is a new row, not a
 * migration, and any metric charts with the same query. The metric names live in code, not
 * in a foreign key, so a coach tracking something unanticipated is not a deployment.
 */
export const measurements = pgTable(
  'measurements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').notNull(),
    metric: text('metric').notNull(),
    value: numeric('value', {
      precision: 8,
      scale: 2,
      mode: 'number',
    }).notNull(),
    unit: text('unit').notNull(),
    measuredAt: date('measured_at', { mode: 'string' }).notNull(),
    source: text('source')
      .$type<MeasurementSource>()
      .notNull()
      .default(MeasurementSource.CHECKIN),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // a measurements row must be in the same workspace as the client it is about
    foreignKey({
      name: 'measurements_client_workspace_fk',
      columns: [table.clientId, table.workspaceId],
      foreignColumns: [clients.id, clients.workspaceId],
    }).onDelete('cascade'),
    // a metric is measured once a day, so submitting again replaces it instead of doubling the point
    unique('measurements_client_metric_day_key').on(
      table.clientId,
      table.metric,
      table.measuredAt,
    ),
    index('measurements_client_metric_idx').on(
      table.clientId,
      table.metric,
      table.measuredAt.desc(),
    ),
    check(
      'measurements_source_check',
      sql`${table.source} in (${sql.raw(SOURCE_VALUES)})`,
    ),
  ],
);
