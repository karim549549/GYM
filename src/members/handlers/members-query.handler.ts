import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import { BaseQueryHandler } from '../../common/handlers/base-query.handler';
import { workspaceMembers } from '../../database/schema';
import { WorkspaceRole } from '../enums/workspace-role.enum';
import type { Specialty } from '../enums/specialty.enum';
import type {
  MemberProfile,
  MemberProfileChanges,
} from '../interfaces/member-profile.interface';
import type { Membership } from '../interfaces/membership.interface';
import type { StoredMember } from '../interfaces/team-member.interface';

const PROFILE = {
  specialties: workspaceMembers.specialties,
  bio: workspaceMembers.bio,
  instagram: workspaceMembers.instagram,
};

/** Data access for the `workspace_members` table: who belongs to which workspace, as what, and whether they own it. */
@Injectable()
export class MembersQueryHandler extends BaseQueryHandler {
  async findMembershipsByPersonId(personId: string): Promise<Membership[]> {
    return this.db
      .select({
        workspaceId: workspaceMembers.workspaceId,
        role: workspaceMembers.role,
        isOwner: workspaceMembers.isOwner,
      })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.personId, personId))
      .orderBy(asc(workspaceMembers.createdAt));
  }

  /** The person who creates a workspace owns it, and coaches in it. */
  async createOwnerMembership(
    workspaceId: string,
    personId: string,
  ): Promise<void> {
    await this.db.insert(workspaceMembers).values({
      workspaceId,
      personId,
      isOwner: true,
      role: WorkspaceRole.COACH,
    });
  }

  async findProfile(
    workspaceId: string,
    personId: string,
  ): Promise<MemberProfile | null> {
    const rows = await this.db
      .select(PROFILE)
      .from(workspaceMembers)
      .where(this.membership(workspaceId, personId))
      .limit(1);
    return this.toProfile(this.firstOrNull(rows));
  }

  /** Sets only the fields given; null clears one. Null when the person is not a member here. */
  async updateProfile(
    workspaceId: string,
    personId: string,
    changes: MemberProfileChanges,
  ): Promise<MemberProfile | null> {
    const rows = await this.db
      .update(workspaceMembers)
      .set({
        ...(changes.specialties !== undefined && {
          specialties: changes.specialties,
        }),
        ...(changes.bio !== undefined && { bio: changes.bio }),
        ...(changes.instagram !== undefined && {
          instagram: changes.instagram,
        }),
      })
      .where(this.membership(workspaceId, personId))
      .returning(PROFILE);
    return this.toProfile(this.firstOrNull(rows));
  }

  /** Everyone in the workspace, the owner first, then by when they joined. */
  async listAll(): Promise<StoredMember[]> {
    return this.db
      .select({
        personId: workspaceMembers.personId,
        role: workspaceMembers.role,
        isOwner: workspaceMembers.isOwner,
        joinedAt: workspaceMembers.createdAt,
      })
      .from(workspaceMembers)
      .orderBy(desc(workspaceMembers.isOwner), asc(workspaceMembers.createdAt));
  }

  async findMember(personId: string): Promise<StoredMember | null> {
    const rows = await this.db
      .select({
        personId: workspaceMembers.personId,
        role: workspaceMembers.role,
        isOwner: workspaceMembers.isOwner,
        joinedAt: workspaceMembers.createdAt,
      })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.personId, personId))
      .limit(1);
    return this.firstOrNull(rows);
  }

  async insertMember(
    workspaceId: string,
    personId: string,
    role: WorkspaceRole,
  ): Promise<void> {
    await this.db
      .insert(workspaceMembers)
      .values({ workspaceId, personId, isOwner: false, role });
  }

  async deleteMember(personId: string): Promise<void> {
    await this.db
      .delete(workspaceMembers)
      .where(eq(workspaceMembers.personId, personId));
  }

  private membership(workspaceId: string, personId: string) {
    return and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.personId, personId),
    );
  }

  /** The column is plain text in the database; the application knows the values are specialties. */
  private toProfile(
    row: {
      specialties: string[];
      bio: string | null;
      instagram: string | null;
    } | null,
  ): MemberProfile | null {
    return row ? { ...row, specialties: row.specialties as Specialty[] } : null;
  }
}
