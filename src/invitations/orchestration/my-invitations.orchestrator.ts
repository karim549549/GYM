import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { InvitationsQueryHandler } from '../handlers/invitations-query.handler';
import type { MyInvitation } from '../interfaces/invitation.interface';

/** Takes over `InvitationsService.mine`: what is waiting for the signed-in person, sent to their own number. */
@Injectable()
export class MyInvitationsOrchestrator {
  constructor(
    private readonly invitationsQuery: InvitationsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(personId: string): Promise<MyInvitation[]> {
    const rows = await this.transactions.run(
      () => this.invitationsQuery.listOpenForMe(),
      { personId },
    );
    return rows.map((row) => ({
      id: row.id,
      brandName: row.brandName,
      role: row.role,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    }));
  }
}
