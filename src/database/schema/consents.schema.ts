import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { ClientConsentType } from '../../consents/enums/client-consent-type.enum';
import { ConsentSource } from '../../consents/enums/consent-source.enum';
import { PersonConsentType } from '../../consents/enums/person-consent-type.enum';
import { clients } from './clients.schema';
import { people } from './people.schema';
import { workspaces } from './workspaces.schema';

const inList = (values: string[]) =>
  sql.raw(values.map((value) => `'${value}'`).join(', '));

/**
 * What an account holder agreed to. A ledger, not a flag: a choice is never edited, a new row says
 * what changed and when, so we can always show what someone agreed to at a given time. The
 * current answer is the newest row for a type (`seq` orders them, the clock can tie).
 */
export const personConsents = pgTable(
  'person_consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    seq: bigint('seq', { mode: 'number' }).generatedAlwaysAsIdentity(),
    personId: uuid('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    type: text('type').$type<PersonConsentType>().notNull(),
    granted: boolean('granted').notNull(),
    /** The version of the text the person saw, so a change of wording can ask again. */
    textVersion: text('text_version').notNull(),
    source: text('source').$type<ConsentSource>().notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('person_consents_person_type_idx').on(
      table.personId,
      table.type,
      table.seq.desc(),
    ),
    check(
      'person_consents_type_check',
      sql`${table.type} in (${inList(Object.values(PersonConsentType))})`,
    ),
    check(
      'person_consents_source_check',
      sql`${table.source} in (${inList(Object.values(ConsentSource))})`,
    ),
  ],
);

/** The same ledger for a coach's client, who may never have an account. A tenant table. */
export const clientConsents = pgTable(
  'client_consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    seq: bigint('seq', { mode: 'number' }).generatedAlwaysAsIdentity(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').notNull(),
    type: text('type').$type<ClientConsentType>().notNull(),
    granted: boolean('granted').notNull(),
    textVersion: text('text_version').notNull(),
    source: text('source').$type<ConsentSource>().notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'client_consents_client_workspace_fk',
      columns: [table.clientId, table.workspaceId],
      foreignColumns: [clients.id, clients.workspaceId],
    }).onDelete('cascade'),
    index('client_consents_client_type_idx').on(
      table.clientId,
      table.type,
      table.seq.desc(),
    ),
    check(
      'client_consents_type_check',
      sql`${table.type} in (${inList(Object.values(ClientConsentType))})`,
    ),
    check(
      'client_consents_source_check',
      sql`${table.source} in (${inList(Object.values(ConsentSource))})`,
    ),
  ],
);
