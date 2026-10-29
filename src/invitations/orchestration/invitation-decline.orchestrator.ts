import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { InvitationStatus } from '../enums/invitation-status.enum';
import { InvitationNotPendingException } from '../exceptions/invitation-exceptions';
import { InvitationsQueryHandler } from '../handlers/invitations-query.handler';
import { InvitationStatePolicy } from '../policies/invitation-state.policy';
import { BaseInvitationOrchestrator } from './base-invitation.orchestrator';

/** Takes over `InvitationsService.decline`: the invited person says no. Nothing is created. */
@Injectable()
export class InvitationDeclineOrchestrator extends BaseInvitationOrchestrator {
  constructor(
    invitationsQuery: InvitationsQueryHandler,
    statePolicy: InvitationStatePolicy,
    transactions: TransactionManager,
  ) {
    super(invitationsQuery, statePolicy, transactions);
  }

  async execute(personId: string, invitationId: string): Promise<void> {
    const invitation = await this.openFor(personId, invitationId);

    await this.transactions.run(
      async () => {
        const taken = await this.invitationsQuery.respond(
          invitation.id,
          InvitationStatus.DECLINED,
        );
        if (!taken) {
          throw new InvitationNotPendingException();
        }
      },
      { workspaceId: invitation.workspaceId },
    );
  }
}
