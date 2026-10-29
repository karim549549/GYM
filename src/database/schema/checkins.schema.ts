import {
  date,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { checkinSchedules } from './checkin-schedules.schema';
import { clients } from './clients.schema';
import { formTemplates } from './form-templates.schema';
import { people } from './people.schema';
import { workspaces } from './workspaces.schema';

/**
 * One check-in a client is asked for, created ahead of its day rather than worked out on the fly.
 * That is what makes a missed one a row (due in the past, never handed in) and so what the coach's
 * "gone quiet" alert and the adherence rate are counted from. The token is the client's credential,
 * as with the intake link.
 */
export const checkins = pgTable(
  'checkins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').notNull(),
    scheduleId: uuid('schedule_id'),
    dueOn: date('due_on', { mode: 'string' }).notNull(),
    token: text('token').notNull().unique(),
    formVersion: text('form_version').notNull(),
    /** The coach's own form it was answered on; empty for the built-in one. */
    templateId: uuid('template_id').references(() => formTemplates.id, {
      onDelete: 'no action',
    }),
    answers: jsonb('answers').$type<Record<string, unknown>>(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    coachReply: text('coach_reply'),
    repliedAt: timestamp('replied_at', { withTimezone: true }),
    repliedBy: uuid('replied_by').references(() => people.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'checkins_client_workspace_fk',
      columns: [table.clientId, table.workspaceId],
      foreignColumns: [clients.id, clients.workspaceId],
    }).onDelete('cascade'),
    foreignKey({
      name: 'checkins_schedule_workspace_fk',
      columns: [table.scheduleId, table.workspaceId],
      foreignColumns: [checkinSchedules.id, checkinSchedules.workspaceId],
    }),
    unique('checkins_client_due_on_key').on(table.clientId, table.dueOn),
    index('checkins_workspace_submitted_idx').on(
      table.workspaceId,
      table.submittedAt.desc().nullsLast(),
    ),
    index('checkins_client_due_on_idx').on(table.clientId, table.dueOn.desc()),
  ],
);
