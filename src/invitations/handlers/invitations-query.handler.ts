import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, gt, lte, sql } from 'drizzle-orm';
import {
  BaseQueryHandler,
  type PaginatedResponse,
} from '../../common/handlers/base-query.handler';
import { workspaceInvitations } from '../../database/schema';
import { InvitationStatus } from '../enums/invitation-status.enum';
import type {
  NewInvitation,
  StoredInvitation,
} from '../interfaces/invitation.interface';
import { InvitationLimitPolicy } from '../policies/invitation-limit.policy';

const RECORD = {
  id: workspaceInvitations.id,
  workspaceId: workspaceInvitations.workspaceId,
  phone: workspaceInvitations.phone,
  role: workspaceInvitations.role,
  status: workspaceInvitations.status,
  brandName: workspaceInvitations.brandName,
  expiresAt: workspaceInvitations.expiresAt,
  respondedAt: workspaceInvitations.respondedAt,
  createdAt: workspaceInvitations.createdAt,
};

/**
 * Data access for `workspace_invitations`. Inside a workspace it sees that workspace's invitations;
 * inside a person's own scope it sees only those addressed to their phone: row level security decides.
 */
@Injectable()
export class InvitationsQueryHandler extends BaseQueryHandler {
  async insert(invitation: NewInvitation): Promise<StoredInvitation> {
    const [row] = await this.db
      .insert(workspaceInvitations)
      .values({
        ...invitation,
        expiresAt: sql`now() + make_interval(days => ${InvitationLimitPolicy.TTL_DAYS})`,
      })
      .returning(RECORD);
    return row;
  }

  /** The invitation for this number that is still waiting, whether or not its date has passed. */
  async findPendingByPhone(phone: string): Promise<StoredInvitation | null> {
    const rows = await this.db
      .select(RECORD)
      .from(workspaceInvitations)
      .where(
        and(
          eq(workspaceInvitations.phone, phone),
          eq(workspaceInvitations.status, InvitationStatus.PENDING),
        ),
      )
      .limit(1);
    return this.firstOrNull(rows);
  }

  /** Takes back what has run out, which frees the number for a new invitation. */
  async retireExpired(phone: string): Promise<void> {
    await this.db
      .update(workspaceInvitations)
      .set({ status: InvitationStatus.REVOKED, respondedAt: sql`now()` })
      .where(
        and(
          eq(workspaceInvitations.phone, phone),
          eq(workspaceInvitations.status, InvitationStatus.PENDING),
          lte(workspaceInvitations.expiresAt, sql`now()`),
        ),
      );
  }

  async countOpen(): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(workspaceInvitations)
      .where(
        and(
          eq(workspaceInvitations.status, InvitationStatus.PENDING),
          gt(workspaceInvitations.expiresAt, sql`now()`),
        ),
      );
    return row.total;
  }

  findById(id: string): Promise<StoredInvitation | null> {
    return this.db
      .select(RECORD)
      .from(workspaceInvitations)
      .where(eq(workspaceInvitations.id, id))
      .limit(1)
      .then((rows) => this.firstOrNull(rows));
  }

  listPage(
    status: InvitationStatus | undefined,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<StoredInvitation>> {
    const where = status ? eq(workspaceInvitations.status, status) : undefined;
    return this.executePageQuery(
      {
        fetchItems: (take, skip) =>
          this.db
            .select(RECORD)
            .from(workspaceInvitations)
            .where(where)
            .orderBy(
              desc(workspaceInvitations.createdAt),
              desc(workspaceInvitations.id),
            )
            .limit(take)
            .offset(skip),
        count: async () => {
          const [row] = await this.db
            .select({ total: count() })
            .from(workspaceInvitations)
            .where(where);
          return row.total;
        },
      },
      page,
      limit,
    );
  }

  /** What is waiting for the person in whose scope this runs, newest first. */
  listOpenForMe(): Promise<StoredInvitation[]> {
    return this.db
      .select(RECORD)
      .from(workspaceInvitations)
      .where(
        and(
          eq(workspaceInvitations.status, InvitationStatus.PENDING),
          gt(workspaceInvitations.expiresAt, sql`now()`),
        ),
      )
      .orderBy(desc(workspaceInvitations.createdAt));
  }

  /**
   * Answers an invitation that is still waiting and still in date. Of two answers at once only one
   * finds it waiting; the other gets nothing back.
   */
  async respond(
    id: string,
    status: InvitationStatus,
  ): Promise<StoredInvitation | null> {
    const rows = await this.db
      .update(workspaceInvitations)
      .set({ status, respondedAt: sql`now()` })
      .where(
        and(
          eq(workspaceInvitations.id, id),
          eq(workspaceInvitations.status, InvitationStatus.PENDING),
          gt(workspaceInvitations.expiresAt, sql`now()`),
        ),
      )
      .returning(RECORD);
    return this.firstOrNull(rows);
  }
}
