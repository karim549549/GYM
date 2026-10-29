import { WorkspaceRole } from '../../members/enums/workspace-role.enum';
import type { Membership } from '../../members/interfaces/membership.interface';
import type { MembersService } from '../../members/members.service';
import type { TransactionManager } from '../../database/transaction.manager';
import type { PeopleService } from '../../people/people.service';
import {
  WorkspaceForbiddenException,
  WorkspaceRequiredException,
} from '../exceptions/auth-exceptions';
import type { VerifiedIdentity } from '../interfaces/verified-identity.interface';
import { WorkspaceSelectionPolicy } from '../policies/workspace-selection.policy';
import { PrincipalResolutionOrchestrator } from './principal-resolution.orchestrator';

const identity: VerifiedIdentity = {
  authUserId: '8f14e45f-ceea-467a-9575-1c2f4e5e1b6a',
  phone: '+201012345678',
};
const person = { id: 'person-1', fullName: 'Sara Ali' };
const A: Membership = {
  workspaceId: '11111111-1111-4111-8111-111111111111',
  role: WorkspaceRole.COACH,
  isOwner: true,
};
const B: Membership = {
  workspaceId: '22222222-2222-4222-8222-222222222222',
  role: WorkspaceRole.ASSISTANT,
  isOwner: false,
};

function setup(memberships: Membership[] = [A], found: unknown = person) {
  const people = {
    findByAuthUserId: jest.fn().mockResolvedValue(found),
  };
  const members = {
    findMembershipsByPersonId: jest.fn().mockResolvedValue(memberships),
  };
  const transactions = {
    run: jest.fn(async (work: () => Promise<unknown>) => work()),
  };
  const orchestrator = new PrincipalResolutionOrchestrator(
    people as unknown as PeopleService,
    members as unknown as MembersService,
    transactions as unknown as TransactionManager,
    new WorkspaceSelectionPolicy(),
  );
  return { people, members, transactions, orchestrator };
}

describe('PrincipalResolutionOrchestrator', () => {
  it('returns nothing, and looks up no memberships, for an unregistered account', async () => {
    const { people, members, orchestrator } = setup([], null);

    await expect(orchestrator.execute(identity)).resolves.toBeUndefined();

    expect(people.findByAuthUserId).toHaveBeenCalledWith(identity.authUserId);
    expect(members.findMembershipsByPersonId).not.toHaveBeenCalled();
  });

  it('reads the memberships inside a transaction scoped to the person only', async () => {
    const { members, transactions, orchestrator } = setup();

    await orchestrator.execute(identity);

    expect(transactions.run).toHaveBeenCalledWith(expect.any(Function), {
      personId: person.id,
    });
    expect(members.findMembershipsByPersonId).toHaveBeenCalledWith(person.id);
  });

  it('builds the principal and acts in the only workspace', async () => {
    const { orchestrator } = setup([A]);

    await expect(orchestrator.execute(identity)).resolves.toEqual({
      personId: person.id,
      authUserId: identity.authUserId,
      fullName: 'Sara Ali',
      memberships: [A],
      workspaceId: A.workspaceId,
      role: WorkspaceRole.COACH,
      isOwner: true,
    });
  });

  it('acts in the asked-for workspace with the role held there', async () => {
    const { orchestrator } = setup([A, B]);

    await expect(
      orchestrator.execute(identity, B.workspaceId),
    ).resolves.toMatchObject({
      workspaceId: B.workspaceId,
      role: WorkspaceRole.ASSISTANT,
      isOwner: false,
      memberships: [A, B],
    });
  });

  it('acts in no workspace for a person who is not a coach anywhere', async () => {
    const { orchestrator } = setup([]);

    const principal = await orchestrator.execute(identity);

    expect(principal).toMatchObject({ personId: person.id, memberships: [] });
    expect(principal?.workspaceId).toBeUndefined();
    expect(principal?.role).toBeUndefined();
  });

  it('requires a choice when there are several workspaces and none was asked for', async () => {
    const { orchestrator } = setup([A, B]);

    await expect(orchestrator.execute(identity)).rejects.toBeInstanceOf(
      WorkspaceRequiredException,
    );
  });

  it('refuses a workspace the person does not belong to', async () => {
    const { orchestrator } = setup([A]);

    await expect(
      orchestrator.execute(identity, B.workspaceId),
    ).rejects.toBeInstanceOf(WorkspaceForbiddenException);
  });
});
