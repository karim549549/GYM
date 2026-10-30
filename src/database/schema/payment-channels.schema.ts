import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { PaymentChannelMethod } from '../../payment-channels/enums/payment-channel-method.enum';
import { workspaces } from './workspaces.schema';

const inList = (values: string[]) =>
  sql.raw(values.map((value) => `'${value}'`).join(', '));

/** Where a coach's clients can send money: InstaPay, a wallet or a bank account. */
export const paymentChannels = pgTable(
  'payment_channels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    method: text('method').$type<PaymentChannelMethod>().notNull(),
    account: text('account').notNull(),
    url: text('url'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('payment_channels_workspace_id_idx').on(table.workspaceId),
    check(
      'payment_channels_method_check',
      sql`${table.method} in (${inList(Object.values(PaymentChannelMethod))})`,
    ),
    check(
      'payment_channels_url_check',
      sql`${table.url} is null or ${table.url} ~ '^https://[^[:space:]]+$'`,
    ),
  ],
);
