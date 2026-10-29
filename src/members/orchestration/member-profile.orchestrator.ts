import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { MemberNotFoundException } from '../exceptions/member-exceptions';
import { MembersQueryHandler } from '../handlers/members-query.handler';
import type { MemberProfile } from '../interfaces/member-profile.interface';

/** Takes over `MembersService.findProfile`: the coach's own profile in the workspace they act in. */
@Injectable()
export class MemberProfileOrchestrator {
  constructor(
    private readonly membersQuery: MembersQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(workspaceId: string, personId: string): Promise<MemberProfile> {
    const profile = await this.transactions.run(
      () => this.membersQuery.findProfile(workspaceId, personId),
      { workspaceId },
    );
    if (!profile) {
      throw new MemberNotFoundException();
    }
    return profile;
  }
}
