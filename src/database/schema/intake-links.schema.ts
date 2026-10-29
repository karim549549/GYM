import { sql } from 'drizzle-orm';
import {
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { clients } from './clients.schema';
import { workspaces } from './workspaces.schema';

/**
 * The address a client opens, without logging in, to fill in their details. The token is
 * the credential: random, short enough to trust in a WhatsApp message, and valid for 14
 * days. A link closes on its first submission; the coach reopens by making a new one.
 */
export const intakeLinks = pgTable(
  'intake_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').notNull(),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '14 days'`),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('intake_links_client_id_idx').on(table.clientId),
    // a intake_links row must be in the same workspace as the client it is about
    foreignKey({
      name: 'intake_links_client_workspace_fk',
      columns: [table.clientId, table.workspaceId],
      foreignColumns: [clients.id, clients.workspaceId],
    }).onDelete('cascade'),
  ],
);
