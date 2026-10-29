import { randomInt, randomUUID } from 'node:crypto';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { eq, inArray } from 'drizzle-orm';
import {
  WorkspaceForbiddenException,
  WorkspaceRequiredException,
} from '../src/auth/exceptions/auth-exceptions';
import type { VerifiedIdentity } from '../src/auth/interfaces/verified-identity.interface';
import { PrincipalResolutionOrchestrator } from '../src/auth/orchestration/principal-resolution.orchestrator';
import { WorkspaceSelectionPolicy } from '../src/auth/policies/workspace-selection.policy';
import { validateEnv } from '../src/config/env.schema';
import { DatabaseModule } from '../src/database/database.module';
import { people, workspaceMembers, workspaces } from '../src/database/schema';
import { TransactionManager } from '../src/database/transaction.manager';
import { WorkspaceRole } from '../src/members/enums/workspace-role.enum';
import { MembersModule } from '../src/members/members.module';
import { PeopleModule } from '../src/people/people.module';
import { PeopleService } from '../src/people/people.service';
import { WorkspacesModule } from '../src/workspaces/workspaces.module';
import { WorkspacesService } from '../src/workspaces/workspaces.service';

const uniquePhone = () => `+2010${randomInt(10_000_000, 99_999_999)}`;
const makeIdentity = (
  extra: Partial<VerifiedIdentity> = {},
): VerifiedIdentity => ({
  authUserId: randomUUID(),
  phone: uniquePhone(),
  ...extra,
});

describe('Principal resolution against the database', () => {
  let moduleRef: TestingModule;
  let principals: PrincipalResolutionOrchestrator;
  let peopleService: PeopleService;
  let workspacesService: WorkspacesService;
  let tx: TransactionManager;

  const created = { personIds: [] as string[], workspaceIds: [] as string[] };
  const brand = () => `Principal Test ${randomInt(100_000, 999_999)}`;

  /** Makes a person who owns a new workspace, the way a coach exists once they have one. */
  const register = async (
    identity = makeIdentity(),
    brandName = brand(),
    fullName = 'Coach Test',
  ) => {
    const person = await peopleService.create({
      phone: identity.phone!,
      email: identity.email,
      authUserId: identity.authUserId,
      fullName,
    });
    created.personIds.push(person.id);
    const workspace = await workspacesService.create({
      brandName,
      ownerId: person.id,
    });
    created.workspaceIds.push(workspace.id);
    const result = { personId: person.id, workspaceId: workspace.id };
    return { identity, result };
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        DatabaseModule,
        PeopleModule,
        MembersModule,
        WorkspacesModule,
      ],
      providers: [PrincipalResolutionOrchestrator, WorkspaceSelectionPolicy],
    }).compile();
    principals = moduleRef.get(PrincipalResolutionOrchestrator);
    peopleService = moduleRef.get(PeopleService);
    workspacesService = moduleRef.get(WorkspacesService);
    tx = moduleRef.get(TransactionManager);
  });

  afterAll(async () => {
    for (const workspaceId of created.workspaceIds) {
      await tx.run(
        () => tx.db.delete(workspaces).where(eq(workspaces.id, workspaceId)),
        { workspaceId },
      );
    }
    await tx.db.delete(people).where(inArray(people.id, created.personIds));
    await moduleRef.close();
  });

  it('returns nothing for an account that is not registered', async () => {
    expect(await principals.execute(makeIdentity())).toBeUndefined();
  });

  it('builds the principal and picks the only workspace', async () => {
    const { identity, result } = await register(
      makeIdentity(),
      brand(),
      'Sara Ali',
    );

    const principal = await principals.execute(identity);

    expect(principal).toEqual({
      personId: result.personId,
      authUserId: identity.authUserId,
      fullName: 'Sara Ali',
      memberships: [
        {
          workspaceId: result.workspaceId,
          role: WorkspaceRole.COACH,
          isOwner: true,
        },
      ],
      workspaceId: result.workspaceId,
      role: WorkspaceRole.COACH,
      isOwner: true,
    });
  });

  it('acts in no workspace for a registered person who is not a coach', async () => {
    const identity = makeIdentity();
    const [person] = await tx.db
      .insert(people)
      .values({
        phone: identity.phone!,
        fullName: 'Plain Client',
        authUserId: identity.authUserId,
      })
      .returning({ id: people.id });
    created.personIds.push(person.id);

    const principal = await principals.execute(identity);

    expect(principal).toMatchObject({ personId: person.id, memberships: [] });
    expect(principal?.workspaceId).toBeUndefined();
  });

  describe('with memberships in two workspaces', () => {
    let identity: VerifiedIdentity;
    let own: string;
    let other: string;
    let stranger: string;

    beforeAll(async () => {
      const mine = await register();
      const theirs = await register();
      const unrelated = await register();
      identity = mine.identity;
      own = mine.result.workspaceId;
      other = theirs.result.workspaceId;
      stranger = unrelated.result.workspaceId;

      await tx.run(
        async () => {
          await tx.db.insert(workspaceMembers).values({
            workspaceId: other,
            personId: mine.result.personId,
            role: WorkspaceRole.ASSISTANT,
          });
        },
        { workspaceId: other },
      );
    });

    it('requires the caller to choose', async () => {
      await expect(principals.execute(identity)).rejects.toBeInstanceOf(
        WorkspaceRequiredException,
      );
    });

    it('acts in the chosen workspace with the role held there', async () => {
      const principal = await principals.execute(identity, other);

      expect(principal).toMatchObject({
        workspaceId: other,
        role: WorkspaceRole.ASSISTANT,
        isOwner: false,
      });
      expect(principal?.memberships).toHaveLength(2);
      expect(principal?.memberships.map((m) => m.workspaceId)).toEqual(
        expect.arrayContaining([own, other]),
      );
    });

    it('refuses a workspace the person does not belong to', async () => {
      await expect(
        principals.execute(identity, stranger),
      ).rejects.toBeInstanceOf(WorkspaceForbiddenException);
    });
  });
});
