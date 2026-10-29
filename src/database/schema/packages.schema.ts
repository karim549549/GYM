import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces.schema';

/**
 * What a coach sells: a length of coaching at a price. Never deleted, only deactivated,
 * because subscriptions already sold point at it. The price is in minor units (piastres).
 */
export const packages = pgTable(
  'packages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    durationDays: integer('duration_days').notNull(),
    priceMinor: bigint('price_minor', { mode: 'number' }).notNull(),
    currency: char('currency', { length: 3 }).notNull().default('EGP'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // lets a subscription prove its package is in its own workspace
    unique('packages_id_workspace_key').on(table.id, table.workspaceId),
    index('packages_workspace_id_idx').on(table.workspaceId),
    check('packages_duration_days_check', sql`${table.durationDays} > 0`),
    check('packages_price_minor_check', sql`${table.priceMinor} >= 0`),
  ],
);
