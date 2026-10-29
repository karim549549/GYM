import { Injectable } from '@nestjs/common';
import { MembersService } from '../../members/members.service';
import { TransactionManager } from '../../database/transaction.manager';
import { PeopleService } from '../../people/people.service';
import {
  WorkspaceForbiddenException,
  WorkspaceRequiredException,
} from '../exceptions/auth-exceptions';
import type { VerifiedIdentity } from '../interfaces/verified-identity.interface';
import type { Principal } from '../interfaces/principal.interface';
import { WorkspaceSelectionPolicy } from '../policies/workspace-selection.policy';

/** Takes over `AuthService.resolvePrincipal`: who is calling, and in which workspace. */
@Injectable()
export class PrincipalResolutionOrchestrator {
  constructor(
    private readonly people: PeopleService,
    private readonly members: MembersService,
    private readonly transactions: TransactionManager,
    private readonly workspaceSelection: WorkspaceSelectionPolicy,
  ) {}

  async execute(
    identity: VerifiedIdentity,
    requestedWorkspaceId?: string,
  ): Promise<Principal | undefined> {
    const person = await this.people.findByAuthUserId(identity.authUserId);
    if (!person) {
      return undefined;
    }

    const memberships = await this.transactions.run(
      () => this.members.findMembershipsByPersonId(person.id),
      { personId: person.id },
    );

    const principal: Principal = {
      personId: person.id,
      authUserId: identity.authUserId,
      fullName: person.fullName,
      memberships,
    };

    const selection = this.workspaceSelection.select(
      memberships,
      requestedWorkspaceId,
    );
    switch (selection.outcome) {
      case 'must_choose':
        throw new WorkspaceRequiredException();
      case 'forbidden':
        throw new WorkspaceForbiddenException();
      case 'selected':
        return {
          ...principal,
          workspaceId: selection.membership.workspaceId,
          role: selection.membership.role,
          isOwner: selection.membership.isOwner,
        };
      default:
        return principal;
    }
  }
}
