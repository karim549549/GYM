import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { MembersQueryHandler } from '../handlers/members-query.handler';

/** Takes over `MembersService.isMember`: whether the person already has a place in the workspace, in any role. */
@Injectable()
export class MembershipCheckOrchestrator {
  constructor(
    private readonly membersQuery: MembersQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(workspaceId: string, personId: string): Promise<boolean> {
    return this.transactions.run(
      async () => (await this.membersQuery.findMember(personId)) !== null,
      { workspaceId },
    );
  }
}
