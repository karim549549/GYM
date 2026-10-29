import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { InvitationStatus } from '../../invitations/enums/invitation-status.enum';
import { WorkspaceRole } from '../../members/enums/workspace-role.enum';
import { people } from './people.schema';
import { workspaces } from './workspaces.schema';

const inList = (values: string[]) =>
  sql.raw(values.map((value) => `'${value}'`).join(', '));

/**
 * An owner inviting a phone number to join the workspace. The number is the address because it is
 * what a person is identified by here, and it was verified when they signed up: whoever signs in
 * with it is who was invited. The brand name is copied so the invited person can read who is asking
 * before they belong to the workspace and could read it.
 */
export const workspaceInvitations = pgTable(
  'workspace_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    phone: text('phone').notNull(),
    role: text('role')
      .$type<WorkspaceRole>()
      .notNull()
      .default(WorkspaceRole.ASSISTANT),
    status: text('status')
      .$type<InvitationStatus>()
      .notNull()
      .default(InvitationStatus.PENDING),
    brandName: text('brand_name').notNull(),
    invitedBy: uuid('invited_by').references(() => people.id, {
      onDelete: 'set null',
    }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // one open invitation per number and workspace: asking again returns it, the database refuses a second
    uniqueIndex('workspace_invitations_one_pending_idx')
      .on(table.workspaceId, table.phone)
      .where(sql`${table.status} = 'pending'`),
    index('workspace_invitations_phone_idx').on(table.phone),
    check(
      'workspace_invitations_status_check',
      sql`${table.status} in (${inList(Object.values(InvitationStatus))})`,
    ),
    check(
      'workspace_invitations_role_check',
      sql`${table.role} in (${inList(Object.values(WorkspaceRole))})`,
    ),
  ],
);
