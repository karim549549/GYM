import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import type { WorkspaceRole } from '../../members/enums/workspace-role.enum';
import { MembersService } from '../../members/members.service';
import { InvitationStatus } from '../enums/invitation-status.enum';
import { InvitationNotPendingException } from '../exceptions/invitation-exceptions';
import { InvitationsQueryHandler } from '../handlers/invitations-query.handler';
import { InvitationStatePolicy } from '../policies/invitation-state.policy';
import { BaseInvitationOrchestrator } from './base-invitation.orchestrator';

/**
 * Takes over `InvitationsService.accept`: the invited person joins the workspace. The invitation is
 * found in their own scope and then answered, and the place made, in one transaction inside the
 * workspace, so of two answers at once one wins and a failure leaves the invitation waiting. A person
 * who already has a place in that workspace cannot take a second one, whatever their role there.
 */
@Injectable()
export class InvitationAcceptanceOrchestrator extends BaseInvitationOrchestrator {
  constructor(
    invitationsQuery: InvitationsQueryHandler,
    statePolicy: InvitationStatePolicy,
    transactions: TransactionManager,
    private readonly members: MembersService,
  ) {
    super(invitationsQuery, statePolicy, transactions);
  }

  async execute(
    personId: string,
    invitationId: string,
  ): Promise<{ workspaceId: string; role: WorkspaceRole }> {
    const invitation = await this.openFor(personId, invitationId);

    await this.transactions.run(
      async () => {
        const taken = await this.invitationsQuery.respond(
          invitation.id,
          InvitationStatus.ACCEPTED,
        );
        if (!taken) {
          throw new InvitationNotPendingException();
        }
        await this.members.add(
          invitation.workspaceId,
          personId,
          invitation.role,
        );
      },
      { workspaceId: invitation.workspaceId },
    );
    return { workspaceId: invitation.workspaceId, role: invitation.role };
  }
}
