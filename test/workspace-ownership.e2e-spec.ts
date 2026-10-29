import { randomInt, randomUUID } from 'node:crypto';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { eq, inArray } from 'drizzle-orm';
import { validateEnv } from '../src/config/env.schema';
import { DatabaseModule } from '../src/database/database.module';
import { people, workspaceMembers, workspaces } from '../src/database/schema';
import { TransactionManager } from '../src/database/transaction.manager';
import { WorkspaceRole } from '../src/members/enums/workspace-role.enum';

/**
 * The rule that a person owns at most one workspace is the database's, so these tests go
 * straight to it, with no service in between.
 */
describe('Owning a workspace against the database', () => {
  let moduleRef: TestingModule;
  let tx: TransactionManager;

  const personIds: string[] = [];
  const workspaceIds: string[] = [];

  const newPerson = async () => {
    const [person] = await tx.db
      .insert(people)
      .values({
        phone: `+2010${randomInt(10_000_000, 99_999_999)}`,
        fullName: 'Owner Test',
        authUserId: randomUUID(),
      })
      .returning({ id: people.id });
    personIds.push(person.id);
    return person.id;
  };

  /** A workspace and a membership in it, written the way the app writes them. */
  const joinNewWorkspace = (
    personId: string,
    membership: { isOwner: boolean; role?: WorkspaceRole },
  ) =>
    tx.run(async () => {
      const [workspace] = await tx.db
        .insert(workspaces)
        .values({
          brandName: 'Ownership Test',
          slug: `ownership-${randomUUID()}`,
        })
        .returning({ id: workspaces.id });
      workspaceIds.push(workspace.id);
      await tx.db
        .insert(workspaceMembers)
        .values({ workspaceId: workspace.id, personId, ...membership });
      return workspace.id;
    });

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        DatabaseModule,
      ],
    }).compile();
    tx = moduleRef.get(TransactionManager);
  });

  afterAll(async () => {
    await workspaceIds.reduce(async (previous, workspaceId) => {
      await previous;

      await tx.run(
        () => tx.db.delete(workspaces).where(eq(workspaces.id, workspaceId)),
        { workspaceId },
      );
    }, Promise.resolve());
    await tx.db.delete(people).where(inArray(people.id, personIds));
    await moduleRef.close();
  });

  it('lets a person own one workspace', async () => {
    const person = await newPerson();

    await expect(joinNewWorkspace(person, { isOwner: true })).resolves.toEqual(
      expect.any(String),
    );
  });

  it('refuses a second workspace for the same owner', async () => {
    const person = await newPerson();
    await joinNewWorkspace(person, { isOwner: true });

    const failure = await joinNewWorkspace(person, { isOwner: true }).catch(
      (error: { cause?: { code?: string; constraint?: string } }) => error,
    );

    expect((failure as { cause?: { code?: string } }).cause?.code).toBe(
      '23505',
    );
    expect(
      (failure as { cause?: { constraint?: string } }).cause?.constraint,
    ).toBe('workspace_members_one_owned_workspace_idx');
  });

  it('leaves no half-made workspace behind when the second one is refused', async () => {
    const person = await newPerson();
    await joinNewWorkspace(person, { isOwner: true });
    const before = workspaceIds.length;

    await joinNewWorkspace(person, { isOwner: true }).catch(() => undefined);

    const refused = workspaceIds[before];
    const rows = await tx.run(
      () =>
        tx.db
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(eq(workspaces.id, refused)),
      { workspaceId: refused },
    );
    expect(rows).toEqual([]);
  });

  it('lets a person work in other people’s workspaces as well as owning one', async () => {
    const owner = await newPerson();
    const helper = await newPerson();
    await joinNewWorkspace(owner, { isOwner: true });

    await joinNewWorkspace(helper, {
      isOwner: false,
      role: WorkspaceRole.ASSISTANT,
    });
    await expect(
      joinNewWorkspace(helper, { isOwner: false, role: WorkspaceRole.COACH }),
    ).resolves.toEqual(expect.any(String));
    await expect(joinNewWorkspace(helper, { isOwner: true })).resolves.toEqual(
      expect.any(String),
    );
  });

  it('gives different people their own workspaces', async () => {
    const first = await newPerson();
    const second = await newPerson();

    await joinNewWorkspace(first, { isOwner: true });

    await expect(joinNewWorkspace(second, { isOwner: true })).resolves.toEqual(
      expect.any(String),
    );
  });
});
