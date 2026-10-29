import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import {
  MemberNotFoundException,
  OwnerCannotBeRemovedException,
} from '../exceptions/member-exceptions';
import { MembersQueryHandler } from '../handlers/members-query.handler';

/**
 * Takes over `MembersService.remove`: the owner takes someone off the team, or a member leaves. Their
 * access ends with the next request, because it is worked out from the membership each time. The
 * owner is never removed this way: moving ownership comes first, and no such operation exists yet.
 */
@Injectable()
export class MemberRemovalOrchestrator {
  constructor(
    private readonly membersQuery: MembersQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(workspaceId: string, personId: string): Promise<void> {
    return this.transactions.run(
      async () => {
        const member = await this.membersQuery.findMember(personId);
        if (!member) {
          throw new MemberNotFoundException();
        }
        if (member.isOwner) {
          throw new OwnerCannotBeRemovedException();
        }
        await this.membersQuery.deleteMember(personId);
      },
      { workspaceId },
    );
  }
}
