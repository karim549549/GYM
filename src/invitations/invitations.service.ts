import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../common/handlers/base-query.handler';
import type { WorkspaceRole } from '../members/enums/workspace-role.enum';
import type { InvitationStatus } from './enums/invitation-status.enum';
import type {
  InvitationRecord,
  MyInvitation,
} from './interfaces/invitation.interface';
import { InvitationAcceptanceOrchestrator } from './orchestration/invitation-acceptance.orchestrator';
import { InvitationCreationOrchestrator } from './orchestration/invitation-creation.orchestrator';
import { InvitationDeclineOrchestrator } from './orchestration/invitation-decline.orchestrator';
import { InvitationListOrchestrator } from './orchestration/invitation-list.orchestrator';
import { InvitationRevocationOrchestrator } from './orchestration/invitation-revocation.orchestrator';
import { MyInvitationsOrchestrator } from './orchestration/my-invitations.orchestrator';

/** The invitations module's interface: how a person is asked to join a workspace, and answers. */
@Injectable()
export class InvitationsService {
  constructor(
    private readonly creation: InvitationCreationOrchestrator,
    private readonly listing: InvitationListOrchestrator,
    private readonly revocation: InvitationRevocationOrchestrator,
    private readonly myInvitations: MyInvitationsOrchestrator,
    private readonly acceptance: InvitationAcceptanceOrchestrator,
    private readonly declining: InvitationDeclineOrchestrator,
  ) {}

  create(
    workspaceId: string,
    invitedBy: string,
    phone: string,
  ): Promise<InvitationRecord> {
    return this.creation.execute(workspaceId, invitedBy, phone);
  }

  list(
    workspaceId: string,
    status?: InvitationStatus,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<InvitationRecord>> {
    return this.listing.execute(workspaceId, status, page, limit);
  }

  revoke(workspaceId: string, invitationId: string): Promise<void> {
    return this.revocation.execute(workspaceId, invitationId);
  }

  mine(personId: string): Promise<MyInvitation[]> {
    return this.myInvitations.execute(personId);
  }

  accept(
    personId: string,
    invitationId: string,
  ): Promise<{ workspaceId: string; role: WorkspaceRole }> {
    return this.acceptance.execute(personId, invitationId);
  }

  decline(personId: string, invitationId: string): Promise<void> {
    return this.declining.execute(personId, invitationId);
  }
}
