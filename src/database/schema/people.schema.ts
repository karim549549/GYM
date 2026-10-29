import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const people = pgTable('people', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: text('phone').notNull().unique(),
  fullName: text('full_name').notNull(),
  email: text('email').unique(),
  authUserId: uuid('auth_user_id').unique(),
  /** When a login last succeeded (password, Google), for activity tracking. */
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
