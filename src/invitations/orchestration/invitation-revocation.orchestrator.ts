import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { InvitationStatus } from '../enums/invitation-status.enum';
import {
  InvitationNotFoundException,
  InvitationNotPendingException,
} from '../exceptions/invitation-exceptions';
import { InvitationsQueryHandler } from '../handlers/invitations-query.handler';
import { InvitationStatePolicy } from '../policies/invitation-state.policy';
import { BaseInvitationOrchestrator } from './base-invitation.orchestrator';

/** Takes over `InvitationsService.revoke`: the owner takes back an invitation that nobody has answered. */
@Injectable()
export class InvitationRevocationOrchestrator extends BaseInvitationOrchestrator {
  constructor(
    invitationsQuery: InvitationsQueryHandler,
    statePolicy: InvitationStatePolicy,
    transactions: TransactionManager,
  ) {
    super(invitationsQuery, statePolicy, transactions);
  }

  execute(workspaceId: string, invitationId: string): Promise<void> {
    return this.transactions.run(
      async () => {
        const found = await this.invitationsQuery.findById(invitationId);
        if (!found) {
          throw new InvitationNotFoundException();
        }
        const taken = await this.invitationsQuery.respond(
          invitationId,
          InvitationStatus.REVOKED,
        );
        if (!taken) {
          throw new InvitationNotPendingException();
        }
      },
      { workspaceId },
    );
  }
}
