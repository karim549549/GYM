import { randomInt, randomUUID } from 'node:crypto';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { eq, inArray } from 'drizzle-orm';
import { validateEnv } from '../src/config/env.schema';
import { DatabaseModule } from '../src/database/database.module';
import { people, workspaceMembers, workspaces } from '../src/database/schema';
import { TransactionManager } from '../src/database/transaction.manager';
import { WorkspaceAlreadyExistsException } from '../src/workspaces/exceptions/workspace-exceptions';
import { WorkspacesModule } from '../src/workspaces/workspaces.module';
import { WorkspacesService } from '../src/workspaces/workspaces.service';

describe('WorkspacesService against the database', () => {
  let moduleRef: TestingModule;
  let workspacesService: WorkspacesService;
  let tx: TransactionManager;
  const workspaceIds: string[] = [];
  const personIds: string[] = [];

  // a brand no earlier run can have taken the handle of
  const uniqueBrand = (label = 'Workspace Test') =>
    `${label} ${randomInt(100_000_000, 999_999_999)}`;

  /** A person with no workspace yet, who can become an owner. */
  const newPerson = async () => {
    const [person] = await tx.db
      .insert(people)
      .values({
        phone: `+2010${randomInt(10_000_000, 99_999_999)}`,
        fullName: 'Workspace Owner',
        authUserId: randomUUID(),
      })
      .returning({ id: people.id });
    personIds.push(person.id);
    return person.id;
  };

  const create = async (brandName: string, ownerId?: string) => {
    const created = await workspacesService.create({
      brandName,
      ownerId: ownerId ?? (await newPerson()),
    });
    workspaceIds.push(created.id);
    return created;
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        DatabaseModule,
        WorkspacesModule,
      ],
    }).compile();
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

  it('creates a workspace with a database-chosen id and a handle from the brand', async () => {
    const brand = uniqueBrand('Ahmed Fitness');

    const created = await create(brand);

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.slug).toBe(brand.toLowerCase().replace(/ /g, '-'));
  });

  it('stores the brand and the defaults, readable in the scope it entered', async () => {
    const brand = uniqueBrand();

    const stored = await tx.run(async () => {
      const created = await create(brand);
      const [row] = await tx.db.select().from(workspaces);
      return { created, row };
    });

    expect(stored.row).toMatchObject({
      id: stored.created.id,
      brandName: brand,
      slug: stored.created.slug,
      currency: 'EGP',
      unitSystem: 'metric',
      expiryAlertDays: 7,
    });
  });

  it('works on its own, without a transaction around it', async () => {
    const created = await create(uniqueBrand());

    expect(created.id).toBeDefined();
    expect(await tx.db.select().from(workspaces)).toEqual([]);
  });

  it('gives a second workspace with the same brand a suffixed handle', async () => {
    const brand = uniqueBrand('Twin');
    const first = await create(brand);

    const second = await create(brand);

    expect(second.slug).not.toBe(first.slug);
    expect(second.slug).toMatch(new RegExp(`^${first.slug}-[a-z0-9]{4}$`));
  });

  it('gives an Arabic-only brand a generic handle', async () => {
    const created = await create('أحمد للياقة');

    expect(created.slug).toMatch(/^coach(-[a-z0-9]{4})?$/);
  });

  it('joins the open transaction, so a later failure undoes the workspace', async () => {
    const brand = uniqueBrand('Rolled Back');
    const owner = await newPerson();
    let createdId: string | undefined;

    await expect(
      tx.run(async () => {
        createdId = (
          await workspacesService.create({ brandName: brand, ownerId: owner })
        ).id;
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');

    const found = await tx.run(
      () =>
        tx.db.select().from(workspaces).where(eq(workspaces.id, createdId!)),
      { workspaceId: createdId },
    );
    expect(found).toEqual([]);
  });

  it('recovers from a taken handle without poisoning the caller’s transaction', async () => {
    const brand = uniqueBrand('Taken');
    const owner = await newPerson();
    await create(brand);

    const outcome = await tx.run(async () => {
      const created = await workspacesService.create({
        brandName: brand,
        ownerId: owner,
      });
      workspaceIds.push(created.id);
      // the transaction is still usable after the collision
      const [row] = await tx.db.select({ id: workspaces.id }).from(workspaces);
      return { created, row };
    });

    expect(outcome.row.id).toBe(outcome.created.id);
  });

  it('refuses to create a second workspace inside the same transaction', async () => {
    const firstOwner = await newPerson();
    const secondOwner = await newPerson();
    await expect(
      tx.run(async () => {
        const first = await workspacesService.create({
          brandName: uniqueBrand(),
          ownerId: firstOwner,
        });
        workspaceIds.push(first.id);
        await workspacesService.create({
          brandName: uniqueBrand(),
          ownerId: secondOwner,
        });
      }),
    ).rejects.toMatchObject({ cause: { code: '42501' } });
  });

  describe('the owner', () => {
    it('makes the person who created it the owner, and a coach in it', async () => {
      const owner = await newPerson();
      const created = await create(uniqueBrand(), owner);

      const memberships = await tx.run(
        () =>
          tx.db
            .select({
              workspaceId: workspaceMembers.workspaceId,
              personId: workspaceMembers.personId,
              isOwner: workspaceMembers.isOwner,
              role: workspaceMembers.role,
            })
            .from(workspaceMembers),
        { workspaceId: created.id },
      );

      expect(memberships).toEqual([
        {
          workspaceId: created.id,
          personId: owner,
          isOwner: true,
          role: 'coach',
        },
      ]);
    });

    it('hands back the brand as it was given', async () => {
      const brand = uniqueBrand('Echoed');

      const created = await create(brand);

      expect(created.brandName).toBe(brand);
    });

    it('refuses a second workspace for a person who already owns one, and leaves nothing behind', async () => {
      const owner = await newPerson();
      await create(uniqueBrand('First'), owner);
      const refused = uniqueBrand('Refused');

      await expect(
        workspacesService.create({ brandName: refused, ownerId: owner }),
      ).rejects.toBeInstanceOf(WorkspaceAlreadyExistsException);

      // had the refused attempt left its workspace behind, it would still hold this handle
      const retry = await create(refused);
      expect(retry.slug).toBe(refused.toLowerCase().replace(/ /g, '-'));
    });

    it('refuses a person who does not exist, and leaves nothing behind', async () => {
      const ghost = uniqueBrand('Ghost');

      await expect(
        workspacesService.create({ brandName: ghost, ownerId: randomUUID() }),
      ).rejects.toThrow();

      const retry = await create(ghost);
      expect(retry.slug).toBe(ghost.toLowerCase().replace(/ /g, '-'));
    });
  });
});
