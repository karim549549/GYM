import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { ReminderAudience } from '../../reminders/enums/reminder-audience.enum';
import { ReminderChannel } from '../../reminders/enums/reminder-channel.enum';
import { ReminderKind } from '../../reminders/enums/reminder-kind.enum';
import { ReminderSubjectType } from '../../reminders/enums/reminder-subject-type.enum';
import { clients } from './clients.schema';
import { workspaces } from './workspaces.schema';

// the allowed values are the enums', so the constraints cannot drift from the code
const inList = (values: string[]) =>
  sql.raw(values.map((value) => `'${value}'`).join(', '));

/**
 * A message that is going to be sent, created ahead of time rather than discovered each morning.
 * That leaves a record of what went out, makes a retry or a second worker harmless (the unique
 * key below is what stops a client being told six times), and keeps the sender trivial: it takes
 * the rows that are due. A row that went out is never touched again.
 */
export const reminders = pgTable(
  'reminders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').notNull(),
    subjectType: text('subject_type').$type<ReminderSubjectType>().notNull(),
    /** The subscription (or intake link, or check-in) being nagged about. */
    subjectId: uuid('subject_id').notNull(),
    kind: text('kind').$type<ReminderKind>().notNull(),
    audience: text('audience').$type<ReminderAudience>().notNull(),
    channel: text('channel')
      .$type<ReminderChannel>()
      .notNull()
      .default(ReminderChannel.WHATSAPP),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
    /** Set when the sender takes the row, before it sends: better to miss one than to send twice. */
    sentAt: timestamp('sent_at', { withTimezone: true }),
    failedReason: text('failed_reason'),
    /** What the message needs that the subject cannot say later, such as the end date it was planned for. */
    payload: jsonb('payload')
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'reminders_client_workspace_fk',
      columns: [table.clientId, table.workspaceId],
      foreignColumns: [clients.id, clients.workspaceId],
    }).onDelete('cascade'),
    unique('reminders_subject_kind_audience_key').on(
      table.subjectType,
      table.subjectId,
      table.kind,
      table.audience,
    ),
    index('reminders_due_idx')
      .on(table.scheduledFor)
      .where(sql`${table.sentAt} is null`),
    check(
      'reminders_subject_type_check',
      sql`${table.subjectType} in (${inList(Object.values(ReminderSubjectType))})`,
    ),
    check(
      'reminders_kind_check',
      sql`${table.kind} in (${inList(Object.values(ReminderKind))})`,
    ),
    check(
      'reminders_audience_check',
      sql`${table.audience} in (${inList(Object.values(ReminderAudience))})`,
    ),
    check(
      'reminders_channel_check',
      sql`${table.channel} in (${inList(Object.values(ReminderChannel))})`,
    ),
  ],
);
