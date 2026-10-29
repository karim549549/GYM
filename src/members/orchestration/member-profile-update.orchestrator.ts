import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { MemberNotFoundException } from '../exceptions/member-exceptions';
import { MembersQueryHandler } from '../handlers/members-query.handler';
import type {
  MemberProfile,
  MemberProfileChanges,
} from '../interfaces/member-profile.interface';

/** Takes over `MembersService.updateProfile`: change what was sent, leave the rest. */
@Injectable()
export class MemberProfileUpdateOrchestrator {
  constructor(
    private readonly membersQuery: MembersQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(
    workspaceId: string,
    personId: string,
    changes: MemberProfileChanges,
  ): Promise<MemberProfile> {
    const profile = await this.transactions.run(
      () =>
        // null is a change (it clears a field); undefined means the field was not sent
        Object.values(changes).some((value) => value !== undefined)
          ? this.membersQuery.updateProfile(workspaceId, personId, changes)
          : this.membersQuery.findProfile(workspaceId, personId),
      { workspaceId },
    );
    if (!profile) {
      throw new MemberNotFoundException();
    }
    return profile;
  }
}
