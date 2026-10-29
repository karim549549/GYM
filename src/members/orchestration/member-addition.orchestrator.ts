import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import type { WorkspaceRole } from '../enums/workspace-role.enum';
import { AlreadyAMemberException } from '../exceptions/member-exceptions';
import { MembersQueryHandler } from '../handlers/members-query.handler';

/**
 * Takes over `MembersService.add`: a person joins a workspace in a role. They hold one place in it:
 * the database's unique rule refuses a second, whatever the role, and this turns that into the
 * module's own error. It joins the transaction of the flow that calls it (accepting an invitation).
 */
@Injectable()
export class MemberAdditionOrchestrator {
  constructor(
    private readonly membersQuery: MembersQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(
    workspaceId: string,
    personId: string,
    role: WorkspaceRole,
  ): Promise<void> {
    try {
      await this.transactions.attempt(() =>
        this.transactions.run(
          () => this.membersQuery.insertMember(workspaceId, personId, role),
          { workspaceId },
        ),
      );
    } catch (error) {
      throw AlreadyAMemberException.causes(error)
        ? new AlreadyAMemberException()
        : error;
    }
  }
}
