import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PeopleService } from '../../people/people.service';
import { MembersQueryHandler } from '../handlers/members-query.handler';
import type { TeamMember } from '../interfaces/team-member.interface';

/** Takes over `MembersService.list`: everyone in the workspace, with their names, the owner first. */
@Injectable()
export class TeamListOrchestrator {
  constructor(
    private readonly membersQuery: MembersQueryHandler,
    private readonly people: PeopleService,
    private readonly transactions: TransactionManager,
  ) {}

  execute(workspaceId: string): Promise<TeamMember[]> {
    return this.transactions.run(
      async () => {
        const members = await this.membersQuery.listAll();
        const contacts = await this.people.findContactsByIds(
          members.map((member) => member.personId),
        );
        return members.flatMap((member) => {
          const contact = contacts.find((c) => c.id === member.personId);
          return contact
            ? [
                {
                  ...member,
                  fullName: contact.fullName,
                  phone: contact.phone,
                },
              ]
            : [];
        });
      },
      { workspaceId },
    );
  }
}
