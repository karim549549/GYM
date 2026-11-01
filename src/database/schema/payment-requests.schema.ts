import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { PaymentMethod } from '../../payments/enums/payment-method.enum';
import { clients } from './clients.schema';
import { payments } from './payments.schema';
import { people } from './people.schema';
import { subscriptions } from './subscriptions.schema';
import { workspaces } from './workspaces.schema';

// the allowed methods are the enum's values, so the constraint cannot drift from the code
const METHOD_VALUES = Object.values(PaymentMethod)
  .map((method) => `'${method}'`)
  .join(', ');

/**
 * A payment the coach asked a client for, sent as a link the client opens with no login. The token only
 * finds the row. Names are a snapshot taken when the link was made, so the public page needs nothing but
 * this row and the workspace's brand. When the client says they paid, `paid_at` and `paid_method` are set:
 * that is the client's word, not money received, and comes with the screenshot they sent. A `payments` row exists only once the coach confirms it, and `payment_id` then points at it.
 */
export const paymentRequests = pgTable(
  'payment_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    subscriptionId: uuid('subscription_id').notNull(),
    clientId: uuid('client_id').notNull(),
    token: text('token').notNull().unique(),
    clientName: text('client_name').notNull(),
    packageName: text('package_name').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    note: text('note'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** Set when the client reported paying. */
    paidAt: timestamp('paid_at', { withTimezone: true }),
    paidMethod: text('paid_method').$type<PaymentMethod>(),
    /** The client's transfer screenshot, a key in the private files bucket; never a URL. */
    receiptKey: text('receipt_key'),
    /** The payment the coach recorded when they confirmed the client's report. */
    paymentId: uuid('payment_id').references(() => payments.id, {
      onDelete: 'set null',
    }),
    createdBy: uuid('created_by').references(() => people.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    // a request must be in the same workspace as the subscription and the client it is about
    foreignKey({
      name: 'payment_requests_subscription_workspace_fk',
      columns: [table.subscriptionId, table.workspaceId],
      foreignColumns: [subscriptions.id, subscriptions.workspaceId],
    }).onDelete('cascade'),
    foreignKey({
      name: 'payment_requests_client_workspace_fk',
      columns: [table.clientId, table.workspaceId],
      foreignColumns: [clients.id, clients.workspaceId],
    }).onDelete('cascade'),
    index('payment_requests_workspace_created_idx').on(
      table.workspaceId,
      table.createdAt.desc(),
    ),
    index('payment_requests_subscription_idx').on(table.subscriptionId),
    check('payment_requests_amount_minor_check', sql`${table.amountMinor} > 0`),
    // paid_at and paid_method are set together, never one without the other
    check(
      'payment_requests_paid_check',
      sql`(${table.paidAt} is null) = (${table.paidMethod} is null)`,
    ),
    check(
      'payment_requests_method_check',
      sql`${table.paidMethod} is null or ${table.paidMethod} in (${sql.raw(METHOD_VALUES)})`,
    ),
  ],
);
