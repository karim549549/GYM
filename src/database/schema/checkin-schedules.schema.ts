import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { CheckinFrequency } from '../../checkins/enums/checkin-frequency.enum';
import { clients } from './clients.schema';
import { workspaces } from './workspaces.schema';

// the allowed values are the enum's, so the constraint cannot drift from the code
const FREQUENCY_VALUES = Object.values(CheckinFrequency)
  .map((frequency) => `'${frequency}'`)
  .join(', ');

/** How a coach wants one client to check in. A client has one schedule; stopping it keeps the row. */
export const checkinSchedules = pgTable(
  'checkin_schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').notNull(),
    frequency: text('frequency')
      .$type<CheckinFrequency>()
      .notNull()
      .default(CheckinFrequency.WEEKLY),
    /** 0 is Sunday. Only a weekly or fortnightly check-in has one. */
    dayOfWeek: integer('day_of_week'),
    /** The hour in Egypt that the client is sent the link. */
    sendHour: integer('send_hour').notNull().default(8),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'checkin_schedules_client_workspace_fk',
      columns: [table.clientId, table.workspaceId],
      foreignColumns: [clients.id, clients.workspaceId],
    }).onDelete('cascade'),
    unique('checkin_schedules_client_key').on(table.clientId),
    // lets a check-in prove it is in its schedule's own workspace
    unique('checkin_schedules_id_workspace_key').on(
      table.id,
      table.workspaceId,
    ),
    check(
      'checkin_schedules_frequency_check',
      sql`${table.frequency} in (${sql.raw(FREQUENCY_VALUES)})`,
    ),
    check(
      'checkin_schedules_day_of_week_check',
      sql`${table.dayOfWeek} is null or ${table.dayOfWeek} between 0 and 6`,
    ),
    check(
      'checkin_schedules_send_hour_check',
      sql`${table.sendHour} between 0 and 23`,
    ),
  ],
);
