import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  pgSequence,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const locksFencingTokenSeq = pgSequence('locks_fencing_token_seq', {
  maxValue: '9007199254740991',
  cycle: false,
});

/** Global infrastructure leases, never client or workspace data. */
export const locks = pgTable(
  'locks',
  {
    key: text('key').primaryKey(),
    owner: text('owner'),
    fencingToken: bigint('fencing_token', { mode: 'number' }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    check(
      'locks_fencing_token_safe',
      sql`${table.fencingToken} between 1 and 9007199254740991`,
    ),
  ],
);
