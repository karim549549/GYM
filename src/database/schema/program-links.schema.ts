import { sql } from 'drizzle-orm';
import {
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { clients } from './clients.schema';
import { workspaces } from './workspaces.schema';

/**
 * The address a client opens, without logging in, to see their program (the active workout plan, and later
 * the nutrition plan). One per client, and it does not expire: the coach resets it instead. The token only
 * finds the row; the client proves who they are with their mobile number and a password they chose on the
 * first visit. Only a hash of that password is kept, and `session_version` going up signs every device out.
 */
export const programLinks = pgTable(
  'program_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').notNull(),
    token: text('token').notNull().unique(),
    /** Null until the client has chosen a password. */
    passwordHash: text('password_hash'),
    passwordSetAt: timestamp('password_set_at', { withTimezone: true }),
    sessionVersion: integer('session_version').notNull().default(1),
    failedAttempts: integer('failed_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    // one link per client
    unique('program_links_client_unique').on(table.clientId),
    // a program_links row must be in the same workspace as the client it is about
    foreignKey({
      name: 'program_links_client_workspace_fk',
      columns: [table.clientId, table.workspaceId],
      foreignColumns: [clients.id, clients.workspaceId],
    }).onDelete('cascade'),
  ],
);
