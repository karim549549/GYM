import { WorkspaceRole } from '../src/members/enums/workspace-role.enum';
import { randomInt, randomUUID } from 'node:crypto';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { eq, inArray } from 'drizzle-orm';
import { MembersModule } from '../src/members/members.module';
import { MembersService } from '../src/members/members.service';
import { validateEnv } from '../src/config/env.schema';
import { DatabaseModule } from '../src/database/database.module';
import { people, workspaceMembers, workspaces } from '../src/database/schema';
import { TransactionManager } from '../src/database/transaction.manager';
import { PeopleModule } from '../src/people/people.module';
import { PeopleService } from '../src/people/people.service';
import { WorkspacesModule } from '../src/workspaces/workspaces.module';
import { WorkspacesService } from '../src/workspaces/workspaces.service';

describe('MembersService against the database', () => {
  let moduleRef: TestingModule;
  let membersService: MembersService;
  let peopleService: PeopleService;
  let workspacesService: WorkspacesService;
  let tx: TransactionManager;

  const personIds: string[] = [];
  const workspaceIds: string[] = [];

  const uniqueBrand = (label = 'Coach Test') =>
    `${label} ${randomInt(100_000_000, 999_999_999)}`;

  /** A person who owns a new workspace, the way a coach exists once they have one. */
  const createOwner = async () => {
    const person = await peopleService.create({
      phone: `+2010${randomInt(10_000_000, 99_999_999)}`,
      authUserId: randomUUID(),
      fullName: 'Coach Test',
    });
    personIds.push(person.id);
    const workspace = await workspacesService.create({
      brandName: uniqueBrand(),
      ownerId: person.id,
    });
    workspaceIds.push(workspace.id);
    return {
      created: {
        personId: person.id,
        workspaceId: workspace.id,
        slug: workspace.slug,
      },
    };
  };

  const membershipsOf = (personId: string) =>
    tx.run(() => membersService.findMembershipsByPersonId(personId), {
      personId,
    });

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        DatabaseModule,
        PeopleModule,
        WorkspacesModule,
        MembersModule,
      ],
    }).compile();
    membersService = moduleRef.get(MembersService);
    peopleService = moduleRef.get(PeopleService);
    workspacesService = moduleRef.get(WorkspacesService);
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

  describe('findMembershipsByPersonId', () => {
    it('lists memberships across workspaces, oldest first', async () => {
      const { created } = await createOwner();
      const other = await createOwner();
      await tx.run(
        () =>
          tx.db.insert(workspaceMembers).values({
            workspaceId: other.created.workspaceId,
            personId: created.personId,
            role: WorkspaceRole.ASSISTANT,
          }),
        { workspaceId: other.created.workspaceId },
      );
      const second = { id: other.created.workspaceId };

      const memberships = await membershipsOf(created.personId);

      expect(memberships.map((m) => m.workspaceId)).toEqual([
        created.workspaceId,
        second.id,
      ]);
    });

    it('returns an empty list, and does not throw, for a person with none', async () => {
      const person = await peopleService.create({
        phone: `+2010${randomInt(10_000_000, 99_999_999)}`,
        fullName: 'No Workspace',
        authUserId: randomUUID(),
      });
      personIds.push(person.id);

      await expect(membershipsOf(person.id)).resolves.toEqual([]);
    });

    it('shows nothing about someone else, even when asked for them by id', async () => {
      const mine = await createOwner();
      const theirs = await createOwner();

      const seen = await tx.run(
        () => membersService.findMembershipsByPersonId(theirs.created.personId),
        { personId: mine.created.personId },
      );

      expect(seen).toEqual([]);
    });
  });

  describe('one owner per workspace', () => {
    const addMember = async (
      workspaceId: string,
      values: { isOwner?: boolean; role?: WorkspaceRole },
    ) => {
      const person = await peopleService.create({
        phone: `+2010${randomInt(10_000_000, 99_999_999)}`,
        authUserId: randomUUID(),
        fullName: 'Another Member',
      });
      personIds.push(person.id);
      await tx.run(
        () =>
          tx.db
            .insert(workspaceMembers)
            .values({ workspaceId, personId: person.id, ...values }),
        { workspaceId },
      );
      return person.id;
    };

    it('refuses a second owner in the same workspace', async () => {
      const { created } = await createOwner();

      const failure = await addMember(created.workspaceId, {
        isOwner: true,
      }).catch((error: unknown) => error as { cause?: { code?: string } });

      expect((failure as { cause?: { code?: string } }).cause?.code).toBe(
        '23505',
      );
      expect(
        JSON.stringify(
          (failure as { cause?: { constraint?: string } }).cause?.constraint,
        ),
      ).toContain('workspace_members_one_owner_idx');
    });

    it('allows any number of members who do not own it', async () => {
      const { created } = await createOwner();

      await addMember(created.workspaceId, { role: WorkspaceRole.ASSISTANT });
      await addMember(created.workspaceId, { role: WorkspaceRole.COACH });

      const members = await tx.run(
        () =>
          tx.db
            .select({ isOwner: workspaceMembers.isOwner })
            .from(workspaceMembers),
        { workspaceId: created.workspaceId },
      );
      expect(members.filter((member) => member.isOwner)).toHaveLength(1);
      expect(members).toHaveLength(3);
    });

    it('lets ownership move to another member in one step', async () => {
      const { created } = await createOwner();
      const successor = await addMember(created.workspaceId, {});

      await tx.run(
        async () => {
          await tx.db
            .update(workspaceMembers)
            .set({ isOwner: false })
            .where(eq(workspaceMembers.personId, created.personId));
          await tx.db
            .update(workspaceMembers)
            .set({ isOwner: true })
            .where(eq(workspaceMembers.personId, successor));
        },
        { workspaceId: created.workspaceId },
      );

      expect(await membershipsOf(successor)).toEqual([
        expect.objectContaining({ isOwner: true }),
      ]);
      expect(await membershipsOf(created.personId)).toEqual([
        expect.objectContaining({ isOwner: false }),
      ]);
    });

    it('gives every workspace its own owner', async () => {
      const first = await createOwner();
      const second = await createOwner();

      expect(await membershipsOf(first.created.personId)).toEqual([
        expect.objectContaining({ isOwner: true }),
      ]);
      expect(await membershipsOf(second.created.personId)).toEqual([
        expect.objectContaining({ isOwner: true }),
      ]);
    });
  });
});
