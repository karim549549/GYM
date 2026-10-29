import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  check,
  date,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { SubscriptionStatus } from '../../subscriptions/enums/subscription-status.enum';
import { clients } from './clients.schema';
import { packages } from './packages.schema';
import { workspaces } from './workspaces.schema';

// the allowed statuses are the enum's values, so the constraint cannot drift from the code
const STATUS_VALUES = Object.values(SubscriptionStatus)
  .map((status) => `'${status}'`)
  .join(', ');

/**
 * A client's period of coaching. The package's name, price and currency are copied here at the
 * time of sale: raising a package's price next month must not rewrite what was charged before.
 * Only the status is stored; "expiring soon" and "payment overdue" are worked out when read.
 */
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').notNull(),
    packageId: uuid('package_id'),
    packageName: text('package_name').notNull(),
    priceMinor: bigint('price_minor', { mode: 'number' }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    startsOn: date('starts_on', { mode: 'string' }).notNull(),
    endsOn: date('ends_on', { mode: 'string' }).notNull(),
    status: text('status')
      .$type<SubscriptionStatus>()
      .notNull()
      .default(SubscriptionStatus.ACTIVE),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // the client and the package must be in this subscription's own workspace
    foreignKey({
      name: 'subscriptions_client_workspace_fk',
      columns: [table.clientId, table.workspaceId],
      foreignColumns: [clients.id, clients.workspaceId],
    }).onDelete('cascade'),
    foreignKey({
      name: 'subscriptions_package_workspace_fk',
      columns: [table.packageId, table.workspaceId],
      foreignColumns: [packages.id, packages.workspaceId],
    }).onDelete('no action'),
    // lets payments and freezes prove they are in the subscription's own workspace
    unique('subscriptions_id_workspace_key').on(table.id, table.workspaceId),
    index('subscriptions_workspace_status_ends_idx').on(
      table.workspaceId,
      table.status,
      table.endsOn,
    ),
    index('subscriptions_client_starts_idx').on(
      table.clientId,
      table.startsOn.desc(),
    ),
    // a client has at most one live subscription: the database refuses a second, not a check in code
    uniqueIndex('subscriptions_one_live_per_client_idx')
      .on(table.clientId)
      .where(sql`${table.status} in ('active', 'frozen')`),
    check(
      'subscriptions_dates_check',
      sql`${table.endsOn} >= ${table.startsOn}`,
    ),
    check('subscriptions_price_minor_check', sql`${table.priceMinor} >= 0`),
    check(
      'subscriptions_status_check',
      sql`${table.status} in (${sql.raw(STATUS_VALUES)})`,
    ),
  ],
);
