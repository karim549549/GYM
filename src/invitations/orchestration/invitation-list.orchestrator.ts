import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../../common/handlers/base-query.handler';
import { TransactionManager } from '../../database/transaction.manager';
import type { InvitationStatus } from '../enums/invitation-status.enum';
import { InvitationsQueryHandler } from '../handlers/invitations-query.handler';
import type { InvitationRecord } from '../interfaces/invitation.interface';
import { InvitationStatePolicy } from '../policies/invitation-state.policy';
import { BaseInvitationOrchestrator } from './base-invitation.orchestrator';

/** Takes over `InvitationsService.list`: a page of the workspace's invitations, newest first. */
@Injectable()
export class InvitationListOrchestrator extends BaseInvitationOrchestrator {
  constructor(
    invitationsQuery: InvitationsQueryHandler,
    statePolicy: InvitationStatePolicy,
    transactions: TransactionManager,
  ) {
    super(invitationsQuery, statePolicy, transactions);
  }

  async execute(
    workspaceId: string,
    status?: InvitationStatus,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<InvitationRecord>> {
    const result = await this.transactions.run(
      () => this.invitationsQuery.listPage(status, page, limit),
      { workspaceId },
    );
    return { ...result, items: result.items.map((row) => this.present(row)) };
  }
}
