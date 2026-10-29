import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { IntakeStatus } from '../../clients/enums/intake-status.enum';
import { people } from './people.schema';
import { workspaces } from './workspaces.schema';

// the allowed statuses are the enum's values, so the constraint cannot drift from the code
const STATUS_VALUES = Object.values(IntakeStatus)
  .map((status) => `'${status}'`)
  .join(', ');

/**
 * A coach's relationship with one person. The phone is kept here as well as on `people`
 * because the coach types it before that person has ever signed up; `person_id` is filled
 * in when they do. Clients are soft-deleted so a removal by mistake loses no payment history.
 */
export const clients = pgTable(
  'clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    personId: uuid('person_id').references(() => people.id, {
      onDelete: 'set null',
    }),
    fullName: text('full_name').notNull(),
    phone: text('phone').notNull(),
    intakeStatus: text('intake_status')
      .$type<IntakeStatus>()
      .notNull()
      .default(IntakeStatus.PENDING),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('clients_workspace_phone_key').on(table.workspaceId, table.phone),
    // lets the tables that hang off a client prove they are in the client's own workspace
    unique('clients_id_workspace_key').on(table.id, table.workspaceId),
    index('clients_workspace_id_idx')
      .on(table.workspaceId)
      .where(sql`${table.deletedAt} is null`),
    index('clients_person_id_idx').on(table.personId),
    check(
      'clients_intake_status_check',
      sql`${table.intakeStatus} in (${sql.raw(STATUS_VALUES)})`,
    ),
  ],
);
