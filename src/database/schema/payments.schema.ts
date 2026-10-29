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
  uuid,
} from 'drizzle-orm/pg-core';
import { PaymentMethod } from '../../payments/enums/payment-method.enum';
import { clients } from './clients.schema';
import { people } from './people.schema';
import { subscriptions } from './subscriptions.schema';
import { workspaces } from './workspaces.schema';

// the allowed methods are the enum's values, so the constraint cannot drift from the code
const METHOD_VALUES = Object.values(PaymentMethod)
  .map((method) => `'${method}'`)
  .join(', ');

/**
 * One row per amount received, never a paid flag: "he paid 800 now and 700 next week" is two
 * rows, and how much is still owed is a sum worked out when asked. `client_id` repeats what the
 * subscription already says so a coach can filter their payments by client without a join.
 */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    subscriptionId: uuid('subscription_id').notNull(),
    clientId: uuid('client_id').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    method: text('method').$type<PaymentMethod>().notNull(),
    paidOn: date('paid_on', { mode: 'string' }).notNull(),
    receiptKey: text('receipt_key'),
    note: text('note'),
    recordedBy: uuid('recorded_by').references(() => people.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // a subscription or client with payments cannot be deleted by itself; the check waits for the end of the
    // statement, so deleting a whole workspace (which removes its payments too) still works
    foreignKey({
      name: 'payments_subscription_workspace_fk',
      columns: [table.subscriptionId, table.workspaceId],
      foreignColumns: [subscriptions.id, subscriptions.workspaceId],
    }).onDelete('no action'),
    foreignKey({
      name: 'payments_client_workspace_fk',
      columns: [table.clientId, table.workspaceId],
      foreignColumns: [clients.id, clients.workspaceId],
    }).onDelete('no action'),
    index('payments_workspace_paid_on_idx').on(
      table.workspaceId,
      table.paidOn.desc(),
    ),
    index('payments_subscription_idx').on(table.subscriptionId),
    index('payments_client_idx').on(table.clientId),
    check('payments_amount_minor_check', sql`${table.amountMinor} > 0`),
    check(
      'payments_method_check',
      sql`${table.method} in (${sql.raw(METHOD_VALUES)})`,
    ),
  ],
);
