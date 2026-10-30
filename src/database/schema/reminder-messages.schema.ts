import { sql } from 'drizzle-orm';
import {
  check,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { ReminderMessageKind } from '../../reminder-messages/enums/reminder-message-kind.enum';
import { workspaces } from './workspaces.schema';

const inList = (values: string[]) =>
  sql.raw(values.map((value) => `'${value}'`).join(', '));

/** The wording a coach chose for each kind of reminder. One row per workspace and kind. */
export const reminderMessages = pgTable(
  'reminder_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<ReminderMessageKind>().notNull(),
    body: text('body').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('reminder_messages_workspace_kind_key').on(
      table.workspaceId,
      table.kind,
    ),
    check(
      'reminder_messages_kind_check',
      sql`${table.kind} in (${inList(Object.values(ReminderMessageKind))})`,
    ),
    check(
      'reminder_messages_body_check',
      sql`char_length(${table.body}) between 1 and 500`,
    ),
  ],
);
