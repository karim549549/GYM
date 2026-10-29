import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { WorkspaceRole } from '../../members/enums/workspace-role.enum';
import { people } from './people.schema';
import { workspaces } from './workspaces.schema';

// the allowed roles are the enum's values, so the constraint cannot drift from the code
const ROLE_VALUES = Object.values(WorkspaceRole)
  .map((role) => `'${role}'`)
  .join(', ');

/** A person's membership of a workspace. Who owns it is `is_owner`; what they do is `role`. */
export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    personId: uuid('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'restrict' }),
    isOwner: boolean('is_owner').notNull().default(false),
    role: text('role')
      .$type<WorkspaceRole>()
      .notNull()
      .default(WorkspaceRole.COACH),
    specialties: text('specialties')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    bio: text('bio'),
    instagram: text('instagram'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('workspace_members_workspace_person_key').on(
      table.workspaceId,
      table.personId,
    ),
    index('workspace_members_person_id_idx').on(table.personId),
    // a person owns at most one workspace (a double tap cannot make two); relax by migration if studios need more
    uniqueIndex('workspace_members_one_owned_workspace_idx')
      .on(table.personId)
      .where(sql`${table.isOwner}`),
    // a workspace has exactly one owner; moving ownership clears the old flag first
    uniqueIndex('workspace_members_one_owner_idx')
      .on(table.workspaceId)
      .where(sql`${table.isOwner}`),
    check(
      'workspace_members_role_check',
      sql`${table.role} in (${sql.raw(ROLE_VALUES)})`,
    ),
  ],
);
