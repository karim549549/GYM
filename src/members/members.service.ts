import { Injectable } from '@nestjs/common';
import { MembersQueryHandler } from './handlers/members-query.handler';
import type {
  MemberProfile,
  MemberProfileChanges,
} from './interfaces/member-profile.interface';
import type { WorkspaceAction } from './enums/workspace-action.enum';
import type { WorkspaceRole } from './enums/workspace-role.enum';
import type { Membership } from './interfaces/membership.interface';
import type { TeamMember } from './interfaces/team-member.interface';
import { MemberAdditionOrchestrator } from './orchestration/member-addition.orchestrator';
import { MemberRemovalOrchestrator } from './orchestration/member-removal.orchestrator';
import { MembershipCheckOrchestrator } from './orchestration/membership-check.orchestrator';
import { TeamListOrchestrator } from './orchestration/team-list.orchestrator';
import { WorkspaceActionCheckOrchestrator } from './orchestration/workspace-action-check.orchestrator';
import type { WorkspaceActor } from './policies/workspace-permission.policy';
import { MemberProfileUpdateOrchestrator } from './orchestration/member-profile-update.orchestrator';
import { MemberProfileOrchestrator } from './orchestration/member-profile.orchestrator';

/** The members module's interface: who belongs to which workspace, as what, and whether they own it. */
@Injectable()
export class MembersService {
  constructor(
    private readonly membersQuery: MembersQueryHandler,
    private readonly memberProfile: MemberProfileOrchestrator,
    private readonly memberProfileUpdate: MemberProfileUpdateOrchestrator,
    private readonly teamList: TeamListOrchestrator,
    private readonly memberAddition: MemberAdditionOrchestrator,
    private readonly memberRemoval: MemberRemovalOrchestrator,
    private readonly membershipCheck: MembershipCheckOrchestrator,
    private readonly actionCheck: WorkspaceActionCheckOrchestrator,
  ) {}

  /** Whether a member's role allows an action in the workspace they are acting in. */
  can(actor: WorkspaceActor, action: WorkspaceAction): boolean {
    return this.actionCheck.execute(actor, action);
  }

  list(workspaceId: string): Promise<TeamMember[]> {
    return this.teamList.execute(workspaceId);
  }

  /** A person joins a workspace in a role, holding one place in it. */
  add(
    workspaceId: string,
    personId: string,
    role: WorkspaceRole,
  ): Promise<void> {
    return this.memberAddition.execute(workspaceId, personId, role);
  }

  isMember(workspaceId: string, personId: string): Promise<boolean> {
    return this.membershipCheck.execute(workspaceId, personId);
  }

  /** The owner takes someone off the team, or a member leaves. Never the owner. */
  remove(workspaceId: string, personId: string): Promise<void> {
    return this.memberRemoval.execute(workspaceId, personId);
  }

  /** Makes the person the owner of the workspace, and a coach in it. */
  addOwner(workspaceId: string, personId: string): Promise<void> {
    return this.membersQuery.createOwnerMembership(workspaceId, personId);
  }

  findMembershipsByPersonId(personId: string): Promise<Membership[]> {
    return this.membersQuery.findMembershipsByPersonId(personId);
  }

  findProfile(workspaceId: string, personId: string): Promise<MemberProfile> {
    return this.memberProfile.execute(workspaceId, personId);
  }

  updateProfile(
    workspaceId: string,
    personId: string,
    changes: MemberProfileChanges,
  ): Promise<MemberProfile> {
    return this.memberProfileUpdate.execute(workspaceId, personId, changes);
  }
}
