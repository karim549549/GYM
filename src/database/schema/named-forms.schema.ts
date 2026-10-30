import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { FormPurpose } from '../../forms/enums/form-purpose.enum';
import { workspaces } from './workspaces.schema';

const inList = (values: string[]) =>
  sql.raw(values.map((value) => `'${value}'`).join(', '));

/**
 * A form the coach keeps under a name ("Weight loss", "Muscle gain"). Its questions live in
 * `form_templates` versions that point back here, so saving it never changes what a client already
 * answered. Archiving hides it from the coach's list; links already sent keep working.
 */
export const namedForms = pgTable(
  'named_forms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    purpose: text('purpose').$type<FormPurpose>().notNull(),
    name: text('name').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // lets a version and an intake link prove they are in the form's own workspace
    unique('named_forms_id_workspace_key').on(table.id, table.workspaceId),
    index('named_forms_workspace_id_idx').on(table.workspaceId),
    check(
      'named_forms_purpose_check',
      sql`${table.purpose} in (${inList(Object.values(FormPurpose))})`,
    ),
    check(
      'named_forms_name_check',
      sql`char_length(${table.name}) between 1 and 60`,
    ),
  ],
);
