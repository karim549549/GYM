import { sql } from 'drizzle-orm';
import {
  check,
  date,
  foreignKey,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { subscriptions } from './subscriptions.schema';
import { workspaces } from './workspaces.schema';

/**
 * Each pause of a subscription, kept rather than only moving the end date, so a coach can always
 * explain to a client why the date moved. An open freeze has no `resumed_on`.
 */
export const subscriptionFreezes = pgTable(
  'subscription_freezes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    subscriptionId: uuid('subscription_id').notNull(),
    frozenOn: date('frozen_on', { mode: 'string' }).notNull(),
    resumedOn: date('resumed_on', { mode: 'string' }),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'subscription_freezes_subscription_workspace_fk',
      columns: [table.subscriptionId, table.workspaceId],
      foreignColumns: [subscriptions.id, subscriptions.workspaceId],
    }).onDelete('cascade'),
    // a subscription is frozen once at a time
    uniqueIndex('subscription_freezes_one_open_idx')
      .on(table.subscriptionId)
      .where(sql`${table.resumedOn} is null`),
    check(
      'subscription_freezes_dates_check',
      sql`${table.resumedOn} is null or ${table.resumedOn} >= ${table.frozenOn}`,
    ),
  ],
);
