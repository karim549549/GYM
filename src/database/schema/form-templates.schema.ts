import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { FormPurpose } from '../../forms/enums/form-purpose.enum';
import { namedForms } from './named-forms.schema';
import { QuestionType } from '../../intake/enums/question-type.enum';
import { workspaces } from './workspaces.schema';

const inList = (values: string[]) =>
  sql.raw(values.map((value) => `'${value}'`).join(', '));

/**
 * A coach's own version of a form. A workspace starts on the built-in form, in code; the first time
 * the coach saves their own, this is where it lives. Editing never changes a row: a new version is
 * inserted and made the current one, so what a client answered stays readable against the questions
 * they were actually asked.
 */
export const formTemplates = pgTable(
  'form_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    purpose: text('purpose').$type<FormPurpose>().notNull(),
    /** The named form this is a version of; null for the coach's single default form of a purpose. */
    namedFormId: uuid('named_form_id'),
    version: integer('version').notNull().default(1),
    /** The version in use: new links and check-ins ask these questions. */
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('form_templates_id_workspace_key').on(table.id, table.workspaceId),
    // the default form of a purpose (not a named one) has one row per version
    uniqueIndex('form_templates_purpose_version_key')
      .on(table.workspaceId, table.purpose, table.version)
      .where(sql`${table.namedFormId} is null`),
    // one current default form per purpose: the database refuses a second, not a check in code
    uniqueIndex('form_templates_one_active_idx')
      .on(table.workspaceId, table.purpose)
      .where(sql`${table.isActive} and ${table.namedFormId} is null`),
    // a named form has its own versions, and one current one
    uniqueIndex('form_templates_named_version_key')
      .on(table.namedFormId, table.version)
      .where(sql`${table.namedFormId} is not null`),
    uniqueIndex('form_templates_named_one_active_idx')
      .on(table.namedFormId)
      .where(sql`${table.isActive} and ${table.namedFormId} is not null`),
    foreignKey({
      name: 'form_templates_named_form_workspace_fk',
      columns: [table.namedFormId, table.workspaceId],
      foreignColumns: [namedForms.id, namedForms.workspaceId],
    }).onDelete('no action'),
    index('form_templates_workspace_id_idx').on(table.workspaceId),
    check(
      'form_templates_purpose_check',
      sql`${table.purpose} in (${inList(Object.values(FormPurpose))})`,
    ),
    check('form_templates_version_check', sql`${table.version} >= 1`),
  ],
);

/**
 * One question of a form. `maps_to_metric` is what keeps the charts working once coaches write their
 * own questions: a number question tagged `weight` is copied into the measurements when answered,
 * and an untagged one just lives in the answers.
 */
export const formQuestions = pgTable(
  'form_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    templateId: uuid('template_id').notNull(),
    position: integer('position').notNull(),
    labelAr: text('label_ar').notNull(),
    labelEn: text('label_en'),
    helpText: text('help_text'),
    inputType: text('input_type').$type<QuestionType>().notNull(),
    /** For the select types: `[{ value, labelAr }]`. */
    options: jsonb('options').$type<{ value: string; labelAr: string }[]>(),
    isRequired: boolean('is_required').notNull().default(false),
    unit: text('unit'),
    mapsToMetric: text('maps_to_metric'),
    minValue: numeric('min_value', { precision: 10, scale: 2, mode: 'number' }),
    maxValue: numeric('max_value', { precision: 10, scale: 2, mode: 'number' }),
    isInteger: boolean('is_integer').notNull().default(false),
    maxLength: integer('max_length'),
  },
  (table) => [
    foreignKey({
      name: 'form_questions_template_workspace_fk',
      columns: [table.templateId, table.workspaceId],
      foreignColumns: [formTemplates.id, formTemplates.workspaceId],
    }).onDelete('cascade'),
    unique('form_questions_template_position_key').on(
      table.templateId,
      table.position,
    ),
    check(
      'form_questions_input_type_check',
      sql`${table.inputType} in (${inList(Object.values(QuestionType))})`,
    ),
  ],
);
