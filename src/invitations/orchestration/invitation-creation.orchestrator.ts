import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { AlreadyAMemberException } from '../../members/exceptions/member-exceptions';
import { WorkspaceRole } from '../../members/enums/workspace-role.enum';
import { MembersService } from '../../members/members.service';
import { PeopleService } from '../../people/people.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { InvitationState } from '../enums/invitation-state.enum';
import { InvitationLimitReachedException } from '../exceptions/invitation-exceptions';
import { InvitationsQueryHandler } from '../handlers/invitations-query.handler';
import type { InvitationRecord } from '../interfaces/invitation.interface';
import { InvitationLimitPolicy } from '../policies/invitation-limit.policy';
import { InvitationStatePolicy } from '../policies/invitation-state.policy';
import { BaseInvitationOrchestrator } from './base-invitation.orchestrator';

/**
 * Takes over `InvitationsService.create`: the owner invites a phone number to join as an assistant.
 * Asking again for a number that has an invitation waiting returns that one. Someone who already
 * belongs to the workspace, in any role, cannot be invited: a person has one place in it.
 */
@Injectable()
export class InvitationCreationOrchestrator extends BaseInvitationOrchestrator {
  constructor(
    invitationsQuery: InvitationsQueryHandler,
    statePolicy: InvitationStatePolicy,
    transactions: TransactionManager,
    private readonly limitPolicy: InvitationLimitPolicy,
    private readonly members: MembersService,
    private readonly people: PeopleService,
    private readonly workspaces: WorkspacesService,
  ) {
    super(invitationsQuery, statePolicy, transactions);
  }

  execute(
    workspaceId: string,
    invitedBy: string,
    phone: string,
  ): Promise<InvitationRecord> {
    return this.transactions.run(
      async () => {
        const person = await this.people.findByPhone(phone);
        if (person && (await this.members.isMember(workspaceId, person.id))) {
          throw new AlreadyAMemberException();
        }

        const waiting = await this.invitationsQuery.findPendingByPhone(phone);
        if (waiting) {
          const state = this.statePolicy.stateOf(waiting, new Date()).outcome;
          if (state === InvitationState.PENDING) {
            return this.present(waiting);
          }
          await this.invitationsQuery.retireExpired(phone);
        }

        const open = await this.invitationsQuery.countOpen();
        if (this.limitPolicy.check(open).outcome === 'limit_reached') {
          throw new InvitationLimitReachedException();
        }

        const workspace = await this.workspaces.findCurrent(workspaceId);
        const created = await this.invitationsQuery.insert({
          workspaceId,
          phone,
          role: WorkspaceRole.ASSISTANT,
          brandName: workspace.brandName,
          invitedBy,
        });
        return this.present(created);
      },
      { workspaceId },
    );
  }
}
