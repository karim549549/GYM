import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { BillingInterval } from '../../billing/enums/billing-interval.enum';
import { InvoicePaymentMethod } from '../../billing/enums/invoice-payment-method.enum';
import { InvoiceStatus } from '../../billing/enums/invoice-status.enum';
import { PlatformSubscriptionStatus } from '../../billing/enums/platform-subscription-status.enum';
import { people } from './people.schema';
import { workspaces } from './workspaces.schema';

const inList = (values: string[]) =>
  sql.raw(values.map((value) => `'${value}'`).join(', '));

/**
 * What the platform sells to coaches: a price, a length and how many clients it allows. Reference
 * data the same for everyone, so it has no workspace. A null limit is unlimited.
 */
export const plansCatalog = pgTable(
  'plans_catalog',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    priceMinor: bigint('price_minor', { mode: 'number' }).notNull(),
    currency: char('currency', { length: 3 }).notNull().default('EGP'),
    clientLimit: integer('client_limit'),
    interval: text('interval')
      .$type<BillingInterval>()
      .notNull()
      .default(BillingInterval.MONTH),
  },
  (table) => [
    check(
      'plans_catalog_interval_check',
      sql`${table.interval} in (${inList(Object.values(BillingInterval))})`,
    ),
    check('plans_catalog_price_check', sql`${table.priceMinor} >= 0`),
  ],
);

/**
 * A coach's plan with the platform. Kept apart from clients' subscriptions on purpose: they run on
 * periods that roll, trials and a client limit, where a client's need freezes and part payments, and
 * one table for both would put a "which kind" on every query and every revenue report.
 */
export const platformSubscriptions = pgTable(
  'platform_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    planId: text('plan_id')
      .notNull()
      .references(() => plansCatalog.id),
    status: text('status')
      .$type<PlatformSubscriptionStatus>()
      .notNull()
      .default(PlatformSubscriptionStatus.TRIALING),
    currentPeriodStart: date('current_period_start', {
      mode: 'string',
    }).notNull(),
    currentPeriodEnd: date('current_period_end', { mode: 'string' }).notNull(),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('platform_subscriptions_workspace_key').on(table.workspaceId),
    check(
      'platform_subscriptions_status_check',
      sql`${table.status} in (${inList(Object.values(PlatformSubscriptionStatus))})`,
    ),
    check(
      'platform_subscriptions_period_check',
      sql`${table.currentPeriodEnd} >= ${table.currentPeriodStart}`,
    ),
  ],
);

/**
 * What a coach owes the platform for a period. Marked paid by a person who looked at the transfer,
 * so there is no gateway and no webhook: `marked_by` records who, which matters the first time two
 * people each think the other confirmed it. `plan_id` is what the invoice buys: paying it puts the
 * coach on that plan.
 */
export const platformInvoices = pgTable(
  'platform_invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    planId: text('plan_id')
      .notNull()
      .references(() => plansCatalog.id),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    periodStart: date('period_start', { mode: 'string' }).notNull(),
    periodEnd: date('period_end', { mode: 'string' }).notNull(),
    status: text('status')
      .$type<InvoiceStatus>()
      .notNull()
      .default(InvoiceStatus.OPEN),
    method: text('method').$type<InvoicePaymentMethod>(),
    receiptKey: text('receipt_key'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    markedBy: uuid('marked_by').references(() => people.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // the collections list: it stays small however many periods accumulate
    index('platform_invoices_open_idx')
      .on(table.status, table.periodEnd)
      .where(sql`${table.status} = 'open'`),
    index('platform_invoices_workspace_idx').on(table.workspaceId),
    check(
      'platform_invoices_status_check',
      sql`${table.status} in (${inList(Object.values(InvoiceStatus))})`,
    ),
    check(
      'platform_invoices_method_check',
      sql`${table.method} is null or ${table.method} in (${inList(Object.values(InvoicePaymentMethod))})`,
    ),
    check('platform_invoices_amount_check', sql`${table.amountMinor} >= 0`),
  ],
);

/**
 * The people who run the platform and so may confirm a coach's transfer. Managed by hand by whoever
 * runs the deployment (an insert, not an endpoint): nothing in the API can make someone an admin.
 */
export const platformAdmins = pgTable('platform_admins', {
  personId: uuid('person_id')
    .primaryKey()
    .references(() => people.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
