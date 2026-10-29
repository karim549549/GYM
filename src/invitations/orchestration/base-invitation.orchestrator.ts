import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { InvitationState } from '../enums/invitation-state.enum';
import {
  InvitationExpiredException,
  InvitationNotFoundException,
  InvitationNotPendingException,
} from '../exceptions/invitation-exceptions';
import { InvitationsQueryHandler } from '../handlers/invitations-query.handler';
import type {
  InvitationRecord,
  StoredInvitation,
} from '../interfaces/invitation.interface';
import { InvitationStatePolicy } from '../policies/invitation-state.policy';

/** What the flows around an invitation share: the state worked out from the date, and finding one for its addressee. */
@Injectable()
export abstract class BaseInvitationOrchestrator {
  constructor(
    protected readonly invitationsQuery: InvitationsQueryHandler,
    protected readonly statePolicy: InvitationStatePolicy,
    protected readonly transactions: TransactionManager,
  ) {}

  protected present(row: StoredInvitation): InvitationRecord {
    return {
      id: row.id,
      phone: row.phone,
      role: row.role,
      state: this.statePolicy.stateOf(row, new Date()).outcome,
      expiresAt: row.expiresAt,
      respondedAt: row.respondedAt,
      createdAt: row.createdAt,
    };
  }

  /**
   * An invitation addressed to this person that can still be answered. The database shows a person only
   * those sent to their own verified number, so one that is not theirs is simply not found.
   */
  protected async openFor(
    personId: string,
    invitationId: string,
  ): Promise<StoredInvitation> {
    const found = await this.transactions.run(
      () => this.invitationsQuery.findById(invitationId),
      { personId },
    );
    if (!found) {
      throw new InvitationNotFoundException();
    }
    const state = this.statePolicy.stateOf(found, new Date()).outcome;
    if (state === InvitationState.EXPIRED) {
      throw new InvitationExpiredException();
    }
    if (state !== InvitationState.PENDING) {
      throw new InvitationNotPendingException();
    }
    return found;
  }
}
