import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { IntakeSubmitter } from '../../intake/enums/intake-submitter.enum';
import { clients } from './clients.schema';
import { formTemplates } from './form-templates.schema';
import { intakeLinks } from './intake-links.schema';
import { workspaces } from './workspaces.schema';

// the allowed values are the enum's, so the constraint cannot drift from the code
const SUBMITTER_VALUES = Object.values(IntakeSubmitter)
  .map((who) => `'${who}'`)
  .join(', ');

/**
 * What a client answered. The answers are kept exactly as submitted, as the record of what
 * they actually typed; the numbers in them are also copied into `measurements`, which is
 * what charts read. `form_version` says which question set produced them.
 */
export const intakeResponses = pgTable(
  'intake_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').notNull(),
    linkId: uuid('link_id').references(() => intakeLinks.id, {
      onDelete: 'set null',
    }),
    answers: jsonb('answers').$type<Record<string, unknown>>().notNull(),
    formVersion: text('form_version').notNull().default('default_v1'),
    /** The coach's own form it was answered on; empty for the built-in one. */
    templateId: uuid('template_id').references(() => formTemplates.id, {
      onDelete: 'no action',
    }),
    submittedBy: text('submitted_by')
      .$type<IntakeSubmitter>()
      .notNull()
      .default(IntakeSubmitter.CLIENT),
    submittedAt: timestamp('submitted_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // a intake_responses row must be in the same workspace as the client it is about
    foreignKey({
      name: 'intake_responses_client_workspace_fk',
      columns: [table.clientId, table.workspaceId],
      foreignColumns: [clients.id, clients.workspaceId],
    }).onDelete('cascade'),
    index('intake_responses_client_id_idx').on(
      table.clientId,
      table.submittedAt.desc(),
    ),
    check(
      'intake_responses_submitted_by_check',
      sql`${table.submittedBy} in (${sql.raw(SUBMITTER_VALUES)})`,
    ),
  ],
);
