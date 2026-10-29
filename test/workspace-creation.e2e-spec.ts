import { WorkspaceRole } from '../src/members/enums/workspace-role.enum';
import { randomInt, randomUUID } from 'node:crypto';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { eq, inArray, sql } from 'drizzle-orm';
import { validateEnv } from '../src/config/env.schema';
import { DatabaseModule } from '../src/database/database.module';
import { people, workspaceMembers, workspaces } from '../src/database/schema';
import { TransactionManager } from '../src/database/transaction.manager';

describe('Creating a workspace against the database', () => {
  let moduleRef: TestingModule;
  let tx: TransactionManager;
  const personIds: string[] = [];
  const workspaceIds: string[] = [];

  const slug = () => `creation-${randomInt(100_000_000, 999_999_999)}`;

  const newPerson = async () => {
    const [person] = await tx.db
      .insert(people)
      .values({
        phone: `+2010${randomInt(10_000_000, 99_999_999)}`,
        fullName: 'Creation Test',
        authUserId: randomUUID(),
      })
      .returning({ id: people.id });
    personIds.push(person.id);
    return person.id;
  };

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
    for (const workspaceId of workspaceIds) {
      await tx.run(
        () => tx.db.delete(workspaces).where(eq(workspaces.id, workspaceId)),
        { workspaceId },
      );
    }
    await tx.db.delete(people).where(inArray(people.id, personIds));
    await moduleRef.close();
  });

  it('lets the database choose the id and hands it back', async () => {
    const created = await tx.run(async () => {
      const [workspace] = await tx.db
        .insert(workspaces)
        .values({ brandName: 'Generated Id', slug: slug() })
        .returning({ id: workspaces.id });
      workspaceIds.push(workspace.id);
      return workspace;
    });

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('puts the transaction in the new workspace, so its first rows can follow', async () => {
    const personId = await newPerson();

    const memberships = await tx.run(async () => {
      const [workspace] = await tx.db
        .insert(workspaces)
        .values({ brandName: 'Self Scoped', slug: slug() })
        .returning({ id: workspaces.id });
      workspaceIds.push(workspace.id);
      await tx.db.insert(workspaceMembers).values({
        workspaceId: workspace.id,
        personId,
        isOwner: true,
        role: WorkspaceRole.COACH,
      });
      return tx.db
        .select({ workspaceId: workspaceMembers.workspaceId })
        .from(workspaceMembers);
    });

    expect(memberships).toEqual([{ workspaceId: workspaceIds.at(-1) }]);
  });

  it('does not leave that scope behind once the transaction ends', async () => {
    await tx.run(async () => {
      const [workspace] = await tx.db
        .insert(workspaces)
        .values({ brandName: 'Temporary Scope', slug: slug() })
        .returning({ id: workspaces.id });
      workspaceIds.push(workspace.id);
    });

    expect(await tx.db.select().from(workspaces)).toEqual([]);
  });

  it('refuses to create a workspace while acting inside another one', async () => {
    const [other] = await tx.run(async () => {
      const rows = await tx.db
        .insert(workspaces)
        .values({ brandName: 'The Other One', slug: slug() })
        .returning({ id: workspaces.id });
      workspaceIds.push(rows[0].id);
      return rows;
    });

    await expect(
      tx.run(
        () =>
          tx.db
            .insert(workspaces)
            .values({ brandName: 'Intruder', slug: slug() })
            .returning({ id: workspaces.id }),
        { workspaceId: other.id },
      ),
    ).rejects.toMatchObject({ cause: { code: '42501' } });
  });

  it('forgets a failed attempt, so the next attempt can enter its own scope', async () => {
    const taken = slug();
    await tx.run(async () => {
      const [workspace] = await tx.db
        .insert(workspaces)
        .values({ brandName: 'Holds The Handle', slug: taken })
        .returning({ id: workspaces.id });
      workspaceIds.push(workspace.id);
    });

    const outcome = await tx.run(async () => {
      await expect(
        tx.attempt(() =>
          tx.db
            .insert(workspaces)
            .values({ brandName: 'Collides', slug: taken })
            .returning({ id: workspaces.id }),
        ),
      ).rejects.toMatchObject({
        cause: { code: '23505', constraint: 'workspaces_slug_unique' },
      });

      const scopeAfterFailure = await tx.db.execute(
        sql`select current_setting('app.workspace_id', true) as scope`,
      );

      const [retry] = await tx.attempt(() =>
        tx.db
          .insert(workspaces)
          .values({ brandName: 'Second Try', slug: slug() })
          .returning({ id: workspaces.id }),
      );
      workspaceIds.push(retry.id);
      return { scopeAfterFailure: scopeAfterFailure.rows[0].scope, retry };
    });

    expect([null, '']).toContain(outcome.scopeAfterFailure);
    expect(outcome.retry.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
