import { NutritionAliasKind } from '../src/foods/enums/nutrition-alias-kind.enum';
import { RecipeOrigin } from '../src/foods/enums/recipe-origin.enum';
import { FoodPublicationStatus } from '../src/foods/enums/food-publication-status.enum';
import { CheckinFrequency } from '../src/checkins/enums/checkin-frequency.enum';
import { ReminderAudience } from '../src/reminders/enums/reminder-audience.enum';
import { ReminderKind } from '../src/reminders/enums/reminder-kind.enum';
import { ReminderSubjectType } from '../src/reminders/enums/reminder-subject-type.enum';
import { MuscleRole } from '../src/exercises/enums/muscle-role.enum';
import { FoodCategory } from '../src/foods/enums/food-category.enum';
import { InvoiceStatus } from '../src/billing/enums/invoice-status.enum';
import { PaymentMethod } from '../src/payments/enums/payment-method.enum';
import { SubscriptionStatus } from '../src/subscriptions/enums/subscription-status.enum';
import { ClientConsentType } from '../src/consents/enums/client-consent-type.enum';
import { ConsentSource } from '../src/consents/enums/consent-source.enum';
import { PersonConsentType } from '../src/consents/enums/person-consent-type.enum';
import { InvitationStatus } from '../src/invitations/enums/invitation-status.enum';
import { FormPurpose } from '../src/forms/enums/form-purpose.enum';
import { QuestionType } from '../src/intake/enums/question-type.enum';
import { WorkspaceRole } from '../src/members/enums/workspace-role.enum';
import { randomBytes, randomInt } from 'node:crypto';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { validateEnv } from '../src/config/env.schema';
import { DatabaseModule } from '../src/database/database.module';
import {
  checkinSchedules,
  checkins,
  clientConsents,
  clients,
  exerciseMuscles,
  exercises,
  nutrients,
  foodNutrients,
  foodAliases,
  foodPublicationRequests,
  recipes,
  recipeIngredients,
  recipeSteps,
  recipePortions,
  recipeAliases,
  foodPortions,
  foods,
  formQuestions,
  formTemplates,
  intakeLinks,
  intakeResponses,
  mealItemSubs,
  mealItems,
  mealPlans,
  meals,
  measurements,
  packages,
  payments,
  people,
  personConsents,
  planDays,
  planExercises,
  planSets,
  plans,
  programLinks,
  platformInvoices,
  platformSubscriptions,
  reminders,
  subscriptionFreezes,
  subscriptions,
  workspaceInvitations,
  workspaceMembers,
  workspaces,
} from '../src/database/schema';
import { TransactionManager } from '../src/database/transaction.manager';

const uniquePhone = () => `+2010${randomInt(10_000_000, 99_999_999)}`;

describe('Tenant isolation against the database', () => {
  let moduleRef: TestingModule;
  let tx: TransactionManager;

  let personA: string;
  let personB: string;
  let workspaceA: string;
  let workspaceB: string;

  const scopeA = () => ({ workspaceId: workspaceA, personId: personA });
  const scopeB = () => ({ workspaceId: workspaceB, personId: personB });

  const createWorkspace = async (
    personId: string,
    brandName: string,
    slug: string,
  ) => {
    const id = crypto.randomUUID();
    await tx.run(
      async () => {
        await tx.db.insert(workspaces).values({ id, brandName, slug });
        await tx.db.insert(workspaceMembers).values({
          workspaceId: id,
          personId,
          isOwner: true,
          role: WorkspaceRole.COACH,
        });
      },
      { workspaceId: id, personId },
    );
    return id;
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        DatabaseModule,
      ],
    }).compile();
    tx = moduleRef.get(TransactionManager);

    const suffix = randomInt(100_000, 999_999);
    const [a, b] = await tx.db
      .insert(people)
      .values([
        { phone: uniquePhone(), fullName: 'Isolation Coach A' },
        { phone: uniquePhone(), fullName: 'Isolation Coach B' },
      ])
      .returning({ id: people.id });
    personA = a.id;
    personB = b.id;

    workspaceA = await createWorkspace(
      personA,
      'Isolation A',
      `iso-a-${suffix}`,
    );
    workspaceB = await createWorkspace(
      personB,
      'Isolation B',
      `iso-b-${suffix}`,
    );

    // person A also assists in workspace B, so memberships span two workspaces
    await tx.run(async () => {
      await tx.db.insert(workspaceMembers).values({
        workspaceId: workspaceB,
        personId: personA,
        role: WorkspaceRole.ASSISTANT,
      });
    }, scopeB());
  });

  afterAll(async () => {
    await tx.run(
      () => tx.db.delete(workspaces).where(eq(workspaces.id, workspaceA)),
      scopeA(),
    );
    await tx.run(
      () => tx.db.delete(workspaces).where(eq(workspaces.id, workspaceB)),
      scopeB(),
    );
    await tx.db.delete(people).where(inArray(people.id, [personA, personB]));
    await moduleRef.close();
  });

  it('shows only its own workspace and members inside a scoped transaction', async () => {
    const seen = await tx.run(
      async () => ({
        workspaces: await tx.db.select({ id: workspaces.id }).from(workspaces),
        members: await tx.db
          .select({ workspaceId: workspaceMembers.workspaceId })
          .from(workspaceMembers),
      }),
      scopeA(),
    );

    expect(seen.workspaces).toEqual([{ id: workspaceA }]);
    expect(seen.members.every((row) => row.workspaceId === workspaceA)).toBe(
      true,
    );
    expect(seen.members).toHaveLength(1);
  });

  it('shows nothing at all outside a scoped transaction', async () => {
    expect(await tx.db.select().from(workspaces)).toEqual([]);
    expect(await tx.db.select().from(workspaceMembers)).toEqual([]);
  });

  it('cannot read another workspace even when asking for it by id', async () => {
    const seen = await tx.run(
      async () =>
        tx.db.select().from(workspaces).where(eq(workspaces.id, workspaceB)),
      scopeA(),
    );

    expect(seen).toEqual([]);
  });

  it('cannot write a row into another workspace', async () => {
    await expect(
      tx.run(async () => {
        await tx.db.insert(workspaceMembers).values({
          workspaceId: workspaceB,
          personId: personA,
          role: WorkspaceRole.COACH,
        });
      }, scopeA()),
    ).rejects.toMatchObject({ cause: { code: '42501' } });
  });

  it('cannot update or delete rows of another workspace', async () => {
    const touched = await tx.run(async () => {
      const updated = await tx.db
        .update(workspaceMembers)
        .set({ role: WorkspaceRole.ASSISTANT })
        .where(eq(workspaceMembers.workspaceId, workspaceB))
        .returning({ id: workspaceMembers.id });
      const deleted = await tx.db
        .delete(workspaceMembers)
        .where(eq(workspaceMembers.workspaceId, workspaceB))
        .returning({ id: workspaceMembers.id });
      return { updated, deleted };
    }, scopeA());

    expect(touched).toEqual({ updated: [], deleted: [] });

    const stillThere = await tx.run(
      async () =>
        tx.db
          .select({
            role: workspaceMembers.role,
            isOwner: workspaceMembers.isOwner,
          })
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, workspaceB),
              eq(workspaceMembers.personId, personB),
            ),
          ),
      scopeB(),
    );
    expect(stillThere).toEqual([{ role: WorkspaceRole.COACH, isOwner: true }]);
  });

  it('lets a person list their own memberships across workspaces', async () => {
    const memberships = await tx.run(
      async () =>
        tx.db
          .select({
            workspaceId: workspaceMembers.workspaceId,
            role: workspaceMembers.role,
            isOwner: workspaceMembers.isOwner,
          })
          .from(workspaceMembers),
      { personId: personA },
    );

    expect(memberships).toHaveLength(2);
    expect(memberships).toEqual(
      expect.arrayContaining([
        {
          workspaceId: workspaceA,
          role: WorkspaceRole.COACH,
          isOwner: true,
        },
        {
          workspaceId: workspaceB,
          role: WorkspaceRole.ASSISTANT,
          isOwner: false,
        },
      ]),
    );
  });

  it('gives a person scope read access only, never write access', async () => {
    await expect(
      tx.run(
        async () => {
          await tx.db.insert(workspaceMembers).values({
            workspaceId: workspaceA,
            personId: personB,
            role: WorkspaceRole.COACH,
          });
        },
        { personId: personA },
      ),
    ).rejects.toMatchObject({ cause: { code: '42501' } });
  });

  it('does not leak a scope into later queries on a reused connection', async () => {
    await Array.from({ length: 5 }).reduce(async (previous) => {
      await previous;
      await tx.run(async () => tx.db.select().from(workspaces), scopeA());
      expect(await tx.db.select().from(workspaces)).toEqual([]);
    }, Promise.resolve());

    const leftover = await tx.db.execute(
      sql`select current_setting('app.workspace_id', true) as workspace`,
    );
    expect([null, '']).toContain(leftover.rows[0].workspace);
  });

  describe('packages', () => {
    let packageA: string;
    let packageB: string;

    const addPackage = (workspaceId: string, name: string) =>
      tx.run(
        async () => {
          const [row] = await tx.db
            .insert(packages)
            .values({
              workspaceId,
              name,
              durationDays: 30,
              priceMinor: 150_000,
            })
            .returning({ id: packages.id });
          return row.id;
        },
        { workspaceId },
      );

    beforeAll(async () => {
      packageA = await addPackage(workspaceA, 'Isolation package A');
      packageB = await addPackage(workspaceB, 'Isolation package B');
    });

    it('shows only its own packages inside a scoped transaction', async () => {
      const seen = await tx.run(
        () => tx.db.select({ id: packages.id }).from(packages),
        scopeA(),
      );

      expect(seen).toEqual([{ id: packageA }]);
    });

    it('shows nothing outside a scoped transaction, so a forgotten scope leaks nothing', async () => {
      expect(await tx.db.select().from(packages)).toEqual([]);
    });

    it('shows nothing to a person scope alone: packages belong to a workspace', async () => {
      const seen = await tx.run(() => tx.db.select().from(packages), {
        personId: personA,
      });

      expect(seen).toEqual([]);
    });

    it('cannot read another workspace’s package even when asking for it by id', async () => {
      const seen = await tx.run(
        () => tx.db.select().from(packages).where(eq(packages.id, packageB)),
        scopeA(),
      );

      expect(seen).toEqual([]);
    });

    it('cannot write a package into another workspace', async () => {
      await expect(
        tx.run(async () => {
          await tx.db.insert(packages).values({
            workspaceId: workspaceB,
            name: 'Smuggled in',
            durationDays: 30,
            priceMinor: 100,
          });
        }, scopeA()),
      ).rejects.toMatchObject({ cause: { code: '42501' } });
    });

    it('cannot update or delete another workspace’s packages', async () => {
      const touched = await tx.run(async () => {
        const updated = await tx.db
          .update(packages)
          .set({ priceMinor: 1 })
          .where(eq(packages.id, packageB))
          .returning({ id: packages.id });
        const deleted = await tx.db
          .delete(packages)
          .where(eq(packages.id, packageB))
          .returning({ id: packages.id });
        return { updated, deleted };
      }, scopeA());

      expect(touched).toEqual({ updated: [], deleted: [] });
      const stillThere = await tx.run(
        () =>
          tx.db
            .select({ priceMinor: packages.priceMinor })
            .from(packages)
            .where(eq(packages.id, packageB)),
        scopeB(),
      );
      expect(stillThere).toEqual([{ priceMinor: 150_000 }]);
    });
  });

  describe('clients', () => {
    let clientA: string;
    let clientB: string;

    const addClient = (workspaceId: string, fullName: string, phone: string) =>
      tx.run(
        async () => {
          const [row] = await tx.db
            .insert(clients)
            .values({ workspaceId, fullName, phone })
            .returning({ id: clients.id });
          return row.id;
        },
        { workspaceId },
      );

    beforeAll(async () => {
      clientA = await addClient(
        workspaceA,
        'Isolation client A',
        uniquePhone(),
      );
      clientB = await addClient(
        workspaceB,
        'Isolation client B',
        uniquePhone(),
      );
    });

    it('shows only its own clients inside a scoped transaction', async () => {
      const seen = await tx.run(
        () => tx.db.select({ id: clients.id }).from(clients),
        scopeA(),
      );

      expect(seen).toEqual([{ id: clientA }]);
    });

    it('shows nothing outside a scoped transaction, so a forgotten scope leaks nothing', async () => {
      expect(await tx.db.select().from(clients)).toEqual([]);
    });

    it('shows nothing to a person scope alone: clients belong to a workspace', async () => {
      const seen = await tx.run(() => tx.db.select().from(clients), {
        personId: personA,
      });

      expect(seen).toEqual([]);
    });

    it('cannot read another workspace’s client even when asking for it by id', async () => {
      const seen = await tx.run(
        () => tx.db.select().from(clients).where(eq(clients.id, clientB)),
        scopeA(),
      );

      expect(seen).toEqual([]);
    });

    it('cannot write a client into another workspace', async () => {
      await expect(
        tx.run(async () => {
          await tx.db.insert(clients).values({
            workspaceId: workspaceB,
            fullName: 'Smuggled in',
            phone: uniquePhone(),
          });
        }, scopeA()),
      ).rejects.toMatchObject({ cause: { code: '42501' } });
    });

    it('cannot update or delete another workspace’s clients', async () => {
      const touched = await tx.run(async () => {
        const updated = await tx.db
          .update(clients)
          .set({ fullName: 'Renamed by a stranger' })
          .where(eq(clients.id, clientB))
          .returning({ id: clients.id });
        const deleted = await tx.db
          .delete(clients)
          .where(eq(clients.id, clientB))
          .returning({ id: clients.id });
        return { updated, deleted };
      }, scopeA());

      expect(touched).toEqual({ updated: [], deleted: [] });
      const stillThere = await tx.run(
        () =>
          tx.db
            .select({ fullName: clients.fullName })
            .from(clients)
            .where(eq(clients.id, clientB)),
        scopeB(),
      );
      expect(stillThere).toEqual([{ fullName: 'Isolation client B' }]);
    });

    it('lets two workspaces have a client with the same phone, since a person can train with two coaches', async () => {
      const shared = uniquePhone();

      await addClient(workspaceA, 'Shared in A', shared);

      await expect(
        addClient(workspaceB, 'Shared in B', shared),
      ).resolves.toEqual(expect.any(String));
    });
  });

  describe('the exercise library', () => {
    let ownA: string;
    let ownB: string;
    let library: string;

    const add = (workspaceId: string, name: string) =>
      tx.run(
        async () =>
          (
            await tx.db
              .insert(exercises)
              .values({ workspaceId, nameAr: name, nameEn: name })
              .returning({ id: exercises.id })
          )[0].id,
        { workspaceId },
      );

    beforeAll(async () => {
      ownA = await add(workspaceA, 'Isolation move A');
      ownB = await add(workspaceB, 'Isolation move B');
      library = (
        await tx.run(
          () =>
            tx.db
              .select({ id: exercises.id })
              .from(exercises)
              .where(eq(exercises.slug, 'plank')),
          scopeA(),
        )
      )[0].id;
    });

    const visible = (scope?: { workspaceId?: string; personId?: string }) =>
      tx.run(() => tx.db.select({ id: exercises.id }).from(exercises), scope);

    it('shows the library and its own additions, and no other workspace’s', async () => {
      const seen = (await visible(scopeA())).map((row) => row.id);

      expect(seen).toContain(ownA);
      expect(seen).toContain(library);
      expect(seen).not.toContain(ownB);
    });

    it('shows only the library outside a scoped transaction, never a workspace’s own', async () => {
      const seen = (await visible()).map((row) => row.id);

      expect(seen).toContain(library);
      expect(seen).not.toContain(ownA);
      expect(seen).not.toContain(ownB);
    });

    it('cannot read another workspace’s exercise even when asking by id', async () => {
      const seen = await tx.run(
        () =>
          tx.db
            .select({ id: exercises.id })
            .from(exercises)
            .where(eq(exercises.id, ownB)),
        scopeA(),
      );

      expect(seen).toEqual([]);
    });

    it('cannot add to another workspace, nor add one to the library', async () => {
      await expect(
        tx.run(
          () =>
            tx.db
              .insert(exercises)
              .values({ workspaceId: workspaceB, nameAr: 'x', nameEn: 'x' }),
          scopeA(),
        ),
      ).rejects.toMatchObject({ cause: { code: '42501' } });
      await expect(
        tx.run(
          () => tx.db.insert(exercises).values({ nameAr: 'x', nameEn: 'x' }),
          scopeA(),
        ),
      ).rejects.toMatchObject({ cause: { code: '42501' } });
    });

    it('cannot change or remove another workspace’s exercise, or the library’s', async () => {
      const touched = await tx.run(async () => {
        const updated = [
          ...(await tx.db
            .update(exercises)
            .set({ nameEn: 'tampered' })
            .where(eq(exercises.id, ownB))
            .returning({ id: exercises.id })),
          ...(await tx.db
            .update(exercises)
            .set({ nameEn: 'tampered' })
            .where(eq(exercises.id, library))
            .returning({ id: exercises.id })),
        ];
        const deleted = [
          ...(await tx.db
            .delete(exercises)
            .where(eq(exercises.id, ownB))
            .returning({ id: exercises.id })),
          ...(await tx.db
            .delete(exercises)
            .where(eq(exercises.id, library))
            .returning({ id: exercises.id })),
        ];
        return { updated, deleted };
      }, scopeA());

      expect(touched).toEqual({ updated: [], deleted: [] });
      expect(await visible(scopeB())).toContainEqual({ id: ownB });
    });

    it('keeps a workspace’s muscle links to itself, and cannot attach one to another’s exercise', async () => {
      await tx.run(
        () =>
          tx.db.insert(exerciseMuscles).values({
            exerciseId: ownA,
            workspaceId: workspaceA,
            muscleId: 'chest',
            role: MuscleRole.PRIMARY,
          }),
        scopeA(),
      );

      const seenByB = await tx.run(
        () =>
          tx.db
            .select({ exerciseId: exerciseMuscles.exerciseId })
            .from(exerciseMuscles)
            .where(eq(exerciseMuscles.exerciseId, ownA)),
        scopeB(),
      );
      await expect(
        tx.run(
          () =>
            tx.db.insert(exerciseMuscles).values({
              exerciseId: ownB,
              workspaceId: workspaceA,
              muscleId: 'chest',
              role: MuscleRole.PRIMARY,
            }),
          scopeA(),
        ),
      ).rejects.toBeDefined();

      expect(seenByB).toEqual([]);
    });
  });

  describe('the food database', () => {
    let ownA: string;
    let ownB: string;
    let library: string;

    const add = (workspaceId: string, name: string) =>
      tx.run(
        async () =>
          (
            await tx.db
              .insert(foods)
              .values({
                workspaceId,
                nameAr: name,
                category: FoodCategory.PROTEIN,
                caloriesKcalPer100g: 100,
                proteinGPer100g: 20,
                carbsGPer100g: 5,
                fatGPer100g: 0,
              })
              .returning({ id: foods.id })
          )[0].id,
        { workspaceId },
      );

    beforeAll(async () => {
      ownA = await add(workspaceA, 'Isolation food A');
      ownB = await add(workspaceB, 'Isolation food B');
      library = (
        await tx.run(
          () =>
            tx.db
              .select({ id: foods.id })
              .from(foods)
              .where(eq(foods.slug, 'chicken-breast-grilled')),
          scopeA(),
        )
      )[0].id;
    });

    const visible = (scope?: { workspaceId?: string; personId?: string }) =>
      tx.run(() => tx.db.select({ id: foods.id }).from(foods), scope);

    it('shows the library and its own additions, and no other workspace’s', async () => {
      const seen = (await visible(scopeA())).map((row) => row.id);

      expect(seen).toContain(ownA);
      expect(seen).toContain(library);
      expect(seen).not.toContain(ownB);
    });

    it('shows only the library outside a scoped transaction, never a workspace’s own', async () => {
      const seen = (await visible()).map((row) => row.id);

      expect(seen).toContain(library);
      expect(seen).not.toContain(ownA);
      expect(seen).not.toContain(ownB);
    });

    it('lets the system read private foods and insert shared copies but grants no tenant inserts, updates or deletes', async () => {
      const rollback = new Error('rollback publication fixtures');
      await tx.run(async () => {
        const [nutrient] = await tx.db
          .select({ id: nutrients.id })
          .from(nutrients)
          .limit(1);
        await tx.db.insert(foodPortions).values({
          foodId: ownB,
          workspaceId: workspaceB,
          nameAr: 'Private serving',
          weightG: 50,
        });
        await tx.db.insert(foodNutrients).values({
          foodId: ownB,
          workspaceId: workspaceB,
          nutrientId: nutrient.id,
          amountPer100g: 0,
        });
        await tx.db.insert(foodAliases).values({
          foodId: ownB,
          workspaceId: workspaceB,
          kind: NutritionAliasKind.ALIAS_EN,
          alias: 'Private alias',
        });
      }, scopeB());
      await expect(
        tx.run(
          async () => {
            const visible = await tx.db
              .select({ id: foods.id })
              .from(foods)
              .where(inArray(foods.id, [ownA, ownB]));
            expect(visible.map((food) => food.id).sort()).toEqual(
              [ownA, ownB].sort(),
            );
            expect(
              await tx.db
                .select()
                .from(foodPortions)
                .where(eq(foodPortions.foodId, ownB)),
            ).toHaveLength(1);
            expect(
              await tx.db
                .select()
                .from(foodNutrients)
                .where(eq(foodNutrients.foodId, ownB)),
            ).toHaveLength(1);
            expect(
              await tx.db
                .select()
                .from(foodAliases)
                .where(eq(foodAliases.foodId, ownB)),
            ).toHaveLength(1);
            const values = {
              nameAr: 'Publication isolation fixture',
              category: FoodCategory.PROTEIN,
              caloriesKcalPer100g: 100,
              proteinGPer100g: 20,
              carbsGPer100g: 5,
              fatGPer100g: 0,
            };
            const [shared] = await tx.db
              .insert(foods)
              .values(values)
              .returning({ id: foods.id });
            await expect(
              tx.attempt(() =>
                tx.db
                  .insert(foods)
                  .values({ ...values, workspaceId: workspaceA }),
              ),
            ).rejects.toMatchObject({ cause: { code: '42501' } });
            expect(
              await tx.db
                .update(foods)
                .set({ nameAr: 'tampered' })
                .where(inArray(foods.id, [ownA, ownB, shared.id]))
                .returning(),
            ).toEqual([]);
            expect(
              await tx.db
                .delete(foods)
                .where(inArray(foods.id, [ownA, ownB, shared.id]))
                .returning(),
            ).toEqual([]);
            const [nutrient] = await tx.db
              .select({ id: nutrients.id })
              .from(nutrients)
              .limit(1);
            await tx.db
              .insert(foodPortions)
              .values({ foodId: shared.id, nameAr: 'حصة', weightG: 50 });
            await tx.db.insert(foodNutrients).values({
              foodId: shared.id,
              nutrientId: nutrient.id,
              amountPer100g: 0,
            });
            await tx.db.insert(foodAliases).values({
              foodId: shared.id,
              kind: NutritionAliasKind.ALIAS_AR,
              alias: 'اسم مشترك',
            });
            expect(
              await tx.db
                .select()
                .from(foodPortions)
                .where(eq(foodPortions.foodId, shared.id)),
            ).toHaveLength(1);
            expect(
              await tx.db
                .select()
                .from(foodNutrients)
                .where(eq(foodNutrients.foodId, shared.id)),
            ).toHaveLength(1);
            expect(
              await tx.db
                .select()
                .from(foodAliases)
                .where(eq(foodAliases.foodId, shared.id)),
            ).toHaveLength(1);
            await expect(
              tx.attempt(() =>
                tx.db.insert(foodPortions).values({
                  foodId: ownA,
                  workspaceId: workspaceA,
                  nameAr: 'No',
                  weightG: 50,
                }),
              ),
            ).rejects.toMatchObject({ cause: { code: '42501' } });
            await expect(
              tx.attempt(() =>
                tx.db.insert(foodNutrients).values({
                  foodId: ownA,
                  workspaceId: workspaceA,
                  nutrientId: nutrient.id,
                  amountPer100g: 0,
                }),
              ),
            ).rejects.toMatchObject({ cause: { code: '42501' } });
            await expect(
              tx.attempt(() =>
                tx.db.insert(foodAliases).values({
                  foodId: ownA,
                  workspaceId: workspaceA,
                  kind: NutritionAliasKind.ALIAS_EN,
                  alias: 'No',
                }),
              ),
            ).rejects.toMatchObject({ cause: { code: '42501' } });
            throw rollback;
          },
          { system: true },
        ),
      ).rejects.toBe(rollback);
    });

    it('cannot add to another workspace, nor add one to the library', async () => {
      const values = {
        nameAr: 'x',
        category: FoodCategory.PROTEIN,
        caloriesKcalPer100g: 1,
        proteinGPer100g: 0,
        carbsGPer100g: 0,
        fatGPer100g: 0,
      };
      await expect(
        tx.run(
          () =>
            tx.db.insert(foods).values({ ...values, workspaceId: workspaceB }),
          scopeA(),
        ),
      ).rejects.toMatchObject({ cause: { code: '42501' } });
      await expect(
        tx.run(() => tx.db.insert(foods).values(values), scopeA()),
      ).rejects.toMatchObject({ cause: { code: '42501' } });
    });

    it('cannot change or remove another workspace’s food, or the library’s', async () => {
      const touched = await tx.run(async () => {
        const updated = [
          ...(await tx.db
            .update(foods)
            .set({ nameAr: 'tampered' })
            .where(eq(foods.id, ownB))
            .returning({ id: foods.id })),
          ...(await tx.db
            .update(foods)
            .set({ nameAr: 'tampered' })
            .where(eq(foods.id, library))
            .returning({ id: foods.id })),
        ];
        const deleted = [
          ...(await tx.db
            .delete(foods)
            .where(eq(foods.id, ownB))
            .returning({ id: foods.id })),
          ...(await tx.db
            .delete(foods)
            .where(eq(foods.id, library))
            .returning({ id: foods.id })),
        ];
        return { updated, deleted };
      }, scopeA());

      expect(touched).toEqual({ updated: [], deleted: [] });
      expect(await visible(scopeB())).toContainEqual({ id: ownB });
    });

    it('keeps a workspace’s portions to itself, and the library’s portions readable by everyone', async () => {
      await tx.run(
        () =>
          tx.db.insert(foodPortions).values({
            foodId: ownA,
            workspaceId: workspaceA,
            nameAr: 'كوب',
            weightG: 100,
          }),
        scopeA(),
      );

      const seenByB = await tx.run(
        () =>
          tx.db
            .select({ id: foodPortions.id })
            .from(foodPortions)
            .where(eq(foodPortions.foodId, ownA)),
        scopeB(),
      );
      const libraryPortions = await tx.run(
        () =>
          tx.db
            .select({ id: foodPortions.id })
            .from(foodPortions)
            .where(eq(foodPortions.foodId, library)),
        scopeB(),
      );

      expect(seenByB).toEqual([]);
      expect(libraryPortions.length).toBeGreaterThan(0);
    });
  });

  describe('what a client hands in', () => {
    let clientA: string;
    let clientB: string;
    let tokenA: string;
    let tokenB: string;

    const token = () => randomBytes(6).toString('base64url');

    const addClient = (workspaceId: string, name: string) =>
      tx.run(
        async () => {
          const [row] = await tx.db
            .insert(clients)
            .values({ workspaceId, fullName: name, phone: uniquePhone() })
            .returning({ id: clients.id });
          return row.id;
        },
        { workspaceId },
      );

    const newSubscription = (
      workspaceId: string,
      clientId: string,
      status: SubscriptionStatus,
    ) => ({
      workspaceId,
      clientId,
      packageName: 'Monthly',
      priceMinor: 150_000,
      currency: 'EGP',
      startsOn: '2026-10-01',
      endsOn: '2026-10-30',
      status,
    });

    const newPayment = (
      workspaceId: string,
      clientId: string,
      subscriptionId: string,
    ) => ({
      workspaceId,
      clientId,
      subscriptionId,
      amountMinor: 100,
      currency: 'EGP',
      method: PaymentMethod.CASH,
      paidOn: '2026-10-26',
    });

    const newCheckin = (workspaceId: string, clientId: string) => ({
      workspaceId,
      clientId,
      dueOn: '2030-01-01',
      token: token(),
      formVersion: 'checkin_v1',
    });

    const newReminder = (workspaceId: string, clientId: string) => ({
      workspaceId,
      clientId,
      subjectType: ReminderSubjectType.SUBSCRIPTION,
      subjectId: crypto.randomUUID(),
      kind: ReminderKind.EXPIRING_SOON,
      audience: ReminderAudience.CLIENT,
      scheduledFor: new Date('2030-01-01T08:00:00Z'),
    });

    /** The library's plank, which every workspace can see. */
    const libraryExercise = async () =>
      (
        await tx.db
          .select({ id: exercises.id })
          .from(exercises)
          .where(eq(exercises.slug, 'plank'))
      )[0].id;

    /** The parents a plan day, exercise or set hangs from, made in the workspace being tested. */
    const parentPlan = async (workspaceId: string, clientId: string) =>
      (
        await tx.db
          .insert(plans)
          .values({ workspaceId, clientId, name: 'Parent' })
          .returning({ id: plans.id })
      )[0].id;

    const parentDay = async (workspaceId: string, clientId: string) =>
      (
        await tx.db
          .insert(planDays)
          .values({
            workspaceId,
            planId: await parentPlan(workspaceId, clientId),
            weekNo: 1,
            dayNo: 1,
          })
          .returning({ id: planDays.id })
      )[0].id;

    const parentExercise = async (workspaceId: string, clientId: string) =>
      (
        await tx.db
          .insert(planExercises)
          .values({
            workspaceId,
            planDayId: await parentDay(workspaceId, clientId),
            exerciseId: await libraryExercise(),
            position: 1,
            exerciseName: 'Plank',
          })
          .returning({ id: planExercises.id })
      )[0].id;

    const newPlatformSubscription = {
      planId: 'basic',
      currentPeriodStart: '2026-10-01',
      currentPeriodEnd: '2026-10-31',
    };

    const newPlatformInvoice = {
      planId: 'basic',
      amountMinor: 39_900,
      currency: 'EGP',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
    };

    const mealMacros = {
      weightG: 100,
      caloriesKcal: 100,
      proteinG: 10,
      carbsG: 10,
      fatG: 1,
    };

    /** A seeded shared food, which every workspace can see. */
    const libraryFood = async () =>
      (
        await tx.db
          .select({ id: foods.id })
          .from(foods)
          .where(eq(foods.slug, 'chicken-breast-grilled'))
      )[0].id;

    const parentMealPlan = async (workspaceId: string, clientId: string) =>
      (
        await tx.db
          .insert(mealPlans)
          .values({ workspaceId, clientId, name: 'Parent' })
          .returning({ id: mealPlans.id })
      )[0].id;

    const newMealItem = async (workspaceId: string, clientId: string) => ({
      ...mealMacros,
      workspaceId,
      mealId: (
        await tx.db
          .insert(meals)
          .values({
            workspaceId,
            mealPlanId: await parentMealPlan(workspaceId, clientId),
            sortOrder: 1,
            name: 'Parent meal',
          })
          .returning({ id: meals.id })
      )[0].id,
      foodId: await libraryFood(),
      sortOrder: 1,
      quantity: 1,
      itemName: 'Koshari',
    });

    /** A finished subscription, which a client may have any number of beside the live one. */
    const finishedSubscription = async (
      workspaceId: string,
      clientId: string,
    ) =>
      (
        await tx.db
          .insert(subscriptions)
          .values(
            newSubscription(workspaceId, clientId, SubscriptionStatus.ENDED),
          )
          .returning({ id: subscriptions.id })
      )[0].id;

    interface Case {
      name: string;
      add: (workspaceId: string, clientId: string) => Promise<string>;
      all: () => Promise<{ id: string }[]>;
      one: (id: string) => Promise<{ id: string }[]>;
      change: (id: string) => Promise<{ id: string }[]>;
      remove: (id: string) => Promise<{ id: string }[]>;
      intruder: (workspaceId: string, clientId: string) => Promise<unknown>;
    }

    const cases: Case[] = [
      {
        name: 'intake links',
        add: async (workspaceId, clientId) =>
          (
            await tx.db
              .insert(intakeLinks)
              .values({ workspaceId, clientId, token: token() })
              .returning({ id: intakeLinks.id })
          )[0].id,
        all: () => tx.db.select({ id: intakeLinks.id }).from(intakeLinks),
        one: (id) =>
          tx.db
            .select({ id: intakeLinks.id })
            .from(intakeLinks)
            .where(eq(intakeLinks.id, id)),
        change: (id) =>
          tx.db
            .update(intakeLinks)
            .set({ submittedAt: new Date() })
            .where(eq(intakeLinks.id, id))
            .returning({ id: intakeLinks.id }),
        remove: (id) =>
          tx.db
            .delete(intakeLinks)
            .where(eq(intakeLinks.id, id))
            .returning({ id: intakeLinks.id }),
        intruder: (workspaceId, clientId) =>
          tx.db
            .insert(intakeLinks)
            .values({ workspaceId, clientId, token: token() }),
      },
      {
        name: 'intake responses',
        add: async (workspaceId, clientId) =>
          (
            await tx.db
              .insert(intakeResponses)
              .values({ workspaceId, clientId, answers: { age: 30 } })
              .returning({ id: intakeResponses.id })
          )[0].id,
        all: () =>
          tx.db.select({ id: intakeResponses.id }).from(intakeResponses),
        one: (id) =>
          tx.db
            .select({ id: intakeResponses.id })
            .from(intakeResponses)
            .where(eq(intakeResponses.id, id)),
        change: (id) =>
          tx.db
            .update(intakeResponses)
            .set({ answers: { age: 99 } })
            .where(eq(intakeResponses.id, id))
            .returning({ id: intakeResponses.id }),
        remove: (id) =>
          tx.db
            .delete(intakeResponses)
            .where(eq(intakeResponses.id, id))
            .returning({ id: intakeResponses.id }),
        intruder: (workspaceId, clientId) =>
          tx.db
            .insert(intakeResponses)
            .values({ workspaceId, clientId, answers: {} }),
      },
      {
        name: 'measurements',
        add: async (workspaceId, clientId) =>
          (
            await tx.db
              .insert(measurements)
              .values({
                workspaceId,
                clientId,
                metric: 'weight',
                value: 80,
                unit: 'kg',
                measuredAt: '2026-10-26',
              })
              .returning({ id: measurements.id })
          )[0].id,
        all: () => tx.db.select({ id: measurements.id }).from(measurements),
        one: (id) =>
          tx.db
            .select({ id: measurements.id })
            .from(measurements)
            .where(eq(measurements.id, id)),
        change: (id) =>
          tx.db
            .update(measurements)
            .set({ value: 1 })
            .where(eq(measurements.id, id))
            .returning({ id: measurements.id }),
        remove: (id) =>
          tx.db
            .delete(measurements)
            .where(eq(measurements.id, id))
            .returning({ id: measurements.id }),
        intruder: (workspaceId, clientId) =>
          tx.db.insert(measurements).values({
            workspaceId,
            clientId,
            metric: 'weight',
            value: 1,
            unit: 'kg',
            measuredAt: '2026-10-26',
          }),
      },

      {
        name: 'subscriptions',
        add: async (workspaceId, clientId) =>
          (
            await tx.db
              .insert(subscriptions)
              .values(
                newSubscription(
                  workspaceId,
                  clientId,
                  SubscriptionStatus.ACTIVE,
                ),
              )
              .returning({ id: subscriptions.id })
          )[0].id,
        // the live ones only: the cases after this one park finished subscriptions to hang their rows on
        all: () =>
          tx.db
            .select({ id: subscriptions.id })
            .from(subscriptions)
            .where(eq(subscriptions.status, SubscriptionStatus.ACTIVE)),
        one: (id) =>
          tx.db
            .select({ id: subscriptions.id })
            .from(subscriptions)
            .where(eq(subscriptions.id, id)),
        change: (id) =>
          tx.db
            .update(subscriptions)
            .set({ priceMinor: 1 })
            .where(eq(subscriptions.id, id))
            .returning({ id: subscriptions.id }),
        remove: (id) =>
          tx.db
            .delete(subscriptions)
            .where(eq(subscriptions.id, id))
            .returning({ id: subscriptions.id }),
        intruder: (workspaceId, clientId) =>
          tx.db
            .insert(subscriptions)
            .values(
              newSubscription(workspaceId, clientId, SubscriptionStatus.ENDED),
            ),
      },
      {
        name: 'subscription freezes',
        add: async (workspaceId, clientId) => {
          const subscriptionId = await finishedSubscription(
            workspaceId,
            clientId,
          );
          return (
            await tx.db
              .insert(subscriptionFreezes)
              .values({ workspaceId, subscriptionId, frozenOn: '2026-10-26' })
              .returning({ id: subscriptionFreezes.id })
          )[0].id;
        },
        all: () =>
          tx.db
            .select({ id: subscriptionFreezes.id })
            .from(subscriptionFreezes),
        one: (id) =>
          tx.db
            .select({ id: subscriptionFreezes.id })
            .from(subscriptionFreezes)
            .where(eq(subscriptionFreezes.id, id)),
        change: (id) =>
          tx.db
            .update(subscriptionFreezes)
            .set({ reason: 'tampered' })
            .where(eq(subscriptionFreezes.id, id))
            .returning({ id: subscriptionFreezes.id }),
        remove: (id) =>
          tx.db
            .delete(subscriptionFreezes)
            .where(eq(subscriptionFreezes.id, id))
            .returning({ id: subscriptionFreezes.id }),
        intruder: (workspaceId) =>
          tx.db.insert(subscriptionFreezes).values({
            workspaceId,
            subscriptionId: crypto.randomUUID(),
            frozenOn: '2026-10-26',
          }),
      },
      {
        name: 'payments',
        add: async (workspaceId, clientId) => {
          const subscriptionId = await finishedSubscription(
            workspaceId,
            clientId,
          );
          return (
            await tx.db
              .insert(payments)
              .values(newPayment(workspaceId, clientId, subscriptionId))
              .returning({ id: payments.id })
          )[0].id;
        },
        all: () => tx.db.select({ id: payments.id }).from(payments),
        one: (id) =>
          tx.db
            .select({ id: payments.id })
            .from(payments)
            .where(eq(payments.id, id)),
        change: (id) =>
          tx.db
            .update(payments)
            .set({ amountMinor: 1 })
            .where(eq(payments.id, id))
            .returning({ id: payments.id }),
        remove: (id) =>
          tx.db
            .delete(payments)
            .where(eq(payments.id, id))
            .returning({ id: payments.id }),
        intruder: (workspaceId, clientId) =>
          tx.db
            .insert(payments)
            .values(newPayment(workspaceId, clientId, crypto.randomUUID())),
      },
      {
        name: 'reminders',
        add: async (workspaceId, clientId) =>
          (
            await tx.db
              .insert(reminders)
              .values(newReminder(workspaceId, clientId))
              .returning({ id: reminders.id })
          )[0].id,
        all: () => tx.db.select({ id: reminders.id }).from(reminders),
        one: (id) =>
          tx.db
            .select({ id: reminders.id })
            .from(reminders)
            .where(eq(reminders.id, id)),
        change: (id) =>
          tx.db
            .update(reminders)
            .set({ failedReason: 'tampered' })
            .where(eq(reminders.id, id))
            .returning({ id: reminders.id }),
        remove: (id) =>
          tx.db
            .delete(reminders)
            .where(eq(reminders.id, id))
            .returning({ id: reminders.id }),
        intruder: (workspaceId, clientId) =>
          tx.db.insert(reminders).values(newReminder(workspaceId, clientId)),
      },
      {
        name: 'check-in schedules',
        add: async (workspaceId, clientId) =>
          (
            await tx.db
              .insert(checkinSchedules)
              .values({ workspaceId, clientId })
              .returning({ id: checkinSchedules.id })
          )[0].id,
        all: () =>
          tx.db.select({ id: checkinSchedules.id }).from(checkinSchedules),
        one: (id) =>
          tx.db
            .select({ id: checkinSchedules.id })
            .from(checkinSchedules)
            .where(eq(checkinSchedules.id, id)),
        change: (id) =>
          tx.db
            .update(checkinSchedules)
            .set({ frequency: CheckinFrequency.DAILY })
            .where(eq(checkinSchedules.id, id))
            .returning({ id: checkinSchedules.id }),
        remove: (id) =>
          tx.db
            .delete(checkinSchedules)
            .where(eq(checkinSchedules.id, id))
            .returning({ id: checkinSchedules.id }),
        intruder: (workspaceId, clientId) =>
          tx.db.insert(checkinSchedules).values({ workspaceId, clientId }),
      },
      {
        name: 'check-ins',
        add: async (workspaceId, clientId) =>
          (
            await tx.db
              .insert(checkins)
              .values(newCheckin(workspaceId, clientId))
              .returning({ id: checkins.id })
          )[0].id,
        all: () => tx.db.select({ id: checkins.id }).from(checkins),
        one: (id) =>
          tx.db
            .select({ id: checkins.id })
            .from(checkins)
            .where(eq(checkins.id, id)),
        change: (id) =>
          tx.db
            .update(checkins)
            .set({ coachReply: 'tampered' })
            .where(eq(checkins.id, id))
            .returning({ id: checkins.id }),
        remove: (id) =>
          tx.db
            .delete(checkins)
            .where(eq(checkins.id, id))
            .returning({ id: checkins.id }),
        intruder: (workspaceId, clientId) =>
          tx.db.insert(checkins).values(newCheckin(workspaceId, clientId)),
      },
      {
        name: 'plans',
        add: async (workspaceId, clientId) =>
          (
            await tx.db
              .insert(plans)
              .values({ workspaceId, clientId, name: 'Plan' })
              .returning({ id: plans.id })
          )[0].id,
        all: () => tx.db.select({ id: plans.id }).from(plans),
        one: (id) =>
          tx.db.select({ id: plans.id }).from(plans).where(eq(plans.id, id)),
        change: (id) =>
          tx.db
            .update(plans)
            .set({ name: 'tampered' })
            .where(eq(plans.id, id))
            .returning({ id: plans.id }),
        remove: (id) =>
          tx.db
            .delete(plans)
            .where(eq(plans.id, id))
            .returning({ id: plans.id }),
        intruder: (workspaceId, clientId) =>
          tx.db.insert(plans).values({ workspaceId, clientId, name: 'x' }),
      },
      {
        name: 'plan days',
        add: async (workspaceId, clientId) =>
          (
            await tx.db
              .insert(planDays)
              .values({
                workspaceId,
                planId: await parentPlan(workspaceId, clientId),
                weekNo: 1,
                dayNo: 1,
              })
              .returning({ id: planDays.id })
          )[0].id,
        all: () => tx.db.select({ id: planDays.id }).from(planDays),
        one: (id) =>
          tx.db
            .select({ id: planDays.id })
            .from(planDays)
            .where(eq(planDays.id, id)),
        change: (id) =>
          tx.db
            .update(planDays)
            .set({ name: 'tampered' })
            .where(eq(planDays.id, id))
            .returning({ id: planDays.id }),
        remove: (id) =>
          tx.db
            .delete(planDays)
            .where(eq(planDays.id, id))
            .returning({ id: planDays.id }),
        intruder: (workspaceId) =>
          tx.db.insert(planDays).values({
            workspaceId,
            planId: crypto.randomUUID(),
            weekNo: 1,
            dayNo: 1,
          }),
      },
      {
        name: 'plan exercises',
        add: async (workspaceId, clientId) =>
          (
            await tx.db
              .insert(planExercises)
              .values({
                workspaceId,
                planDayId: await parentDay(workspaceId, clientId),
                exerciseId: await libraryExercise(),
                position: 1,
                exerciseName: 'Plank',
              })
              .returning({ id: planExercises.id })
          )[0].id,
        all: () => tx.db.select({ id: planExercises.id }).from(planExercises),
        one: (id) =>
          tx.db
            .select({ id: planExercises.id })
            .from(planExercises)
            .where(eq(planExercises.id, id)),
        change: (id) =>
          tx.db
            .update(planExercises)
            .set({ coachNote: 'tampered' })
            .where(eq(planExercises.id, id))
            .returning({ id: planExercises.id }),
        remove: (id) =>
          tx.db
            .delete(planExercises)
            .where(eq(planExercises.id, id))
            .returning({ id: planExercises.id }),
        intruder: async (workspaceId) =>
          tx.db.insert(planExercises).values({
            workspaceId,
            planDayId: crypto.randomUUID(),
            exerciseId: await libraryExercise(),
            position: 1,
            exerciseName: 'x',
          }),
      },
      {
        name: 'plan sets',
        add: async (workspaceId, clientId) =>
          (
            await tx.db
              .insert(planSets)
              .values({
                workspaceId,
                planExerciseId: await parentExercise(workspaceId, clientId),
                setNo: 1,
              })
              .returning({ id: planSets.id })
          )[0].id,
        all: () => tx.db.select({ id: planSets.id }).from(planSets),
        one: (id) =>
          tx.db
            .select({ id: planSets.id })
            .from(planSets)
            .where(eq(planSets.id, id)),
        change: (id) =>
          tx.db
            .update(planSets)
            .set({ reps: 'tampered' })
            .where(eq(planSets.id, id))
            .returning({ id: planSets.id }),
        remove: (id) =>
          tx.db
            .delete(planSets)
            .where(eq(planSets.id, id))
            .returning({ id: planSets.id }),
        intruder: (workspaceId) =>
          tx.db.insert(planSets).values({
            workspaceId,
            planExerciseId: crypto.randomUUID(),
            setNo: 1,
          }),
      },
      {
        name: 'meal plans',
        add: async (workspaceId, clientId) =>
          (
            await tx.db
              .insert(mealPlans)
              .values({ workspaceId, clientId, name: 'Plan' })
              .returning({ id: mealPlans.id })
          )[0].id,
        all: () => tx.db.select({ id: mealPlans.id }).from(mealPlans),
        one: (id) =>
          tx.db
            .select({ id: mealPlans.id })
            .from(mealPlans)
            .where(eq(mealPlans.id, id)),
        change: (id) =>
          tx.db
            .update(mealPlans)
            .set({ name: 'tampered' })
            .where(eq(mealPlans.id, id))
            .returning({ id: mealPlans.id }),
        remove: (id) =>
          tx.db
            .delete(mealPlans)
            .where(eq(mealPlans.id, id))
            .returning({ id: mealPlans.id }),
        intruder: (workspaceId, clientId) =>
          tx.db.insert(mealPlans).values({ workspaceId, clientId, name: 'x' }),
      },
      {
        name: 'meals',
        add: async (workspaceId, clientId) =>
          (
            await tx.db
              .insert(meals)
              .values({
                workspaceId,
                mealPlanId: await parentMealPlan(workspaceId, clientId),
                sortOrder: 1,
                name: 'Lunch',
              })
              .returning({ id: meals.id })
          )[0].id,
        all: () => tx.db.select({ id: meals.id }).from(meals),
        one: (id) =>
          tx.db.select({ id: meals.id }).from(meals).where(eq(meals.id, id)),
        change: (id) =>
          tx.db
            .update(meals)
            .set({ name: 'tampered' })
            .where(eq(meals.id, id))
            .returning({ id: meals.id }),
        remove: (id) =>
          tx.db
            .delete(meals)
            .where(eq(meals.id, id))
            .returning({ id: meals.id }),
        intruder: (workspaceId) =>
          tx.db.insert(meals).values({
            workspaceId,
            mealPlanId: crypto.randomUUID(),
            sortOrder: 1,
            name: 'x',
          }),
      },
      {
        name: 'meal items',
        add: async (workspaceId, clientId) =>
          (
            await tx.db
              .insert(mealItems)
              .values(await newMealItem(workspaceId, clientId))
              .returning({ id: mealItems.id })
          )[0].id,
        all: () => tx.db.select({ id: mealItems.id }).from(mealItems),
        one: (id) =>
          tx.db
            .select({ id: mealItems.id })
            .from(mealItems)
            .where(eq(mealItems.id, id)),
        change: (id) =>
          tx.db
            .update(mealItems)
            .set({ itemName: 'tampered' })
            .where(eq(mealItems.id, id))
            .returning({ id: mealItems.id }),
        remove: (id) =>
          tx.db
            .delete(mealItems)
            .where(eq(mealItems.id, id))
            .returning({ id: mealItems.id }),
        intruder: async (workspaceId) =>
          tx.db.insert(mealItems).values({
            ...mealMacros,
            workspaceId,
            mealId: crypto.randomUUID(),
            foodId: await libraryFood(),
            sortOrder: 1,
            quantity: 1,
            itemName: 'x',
          }),
      },
      {
        name: 'meal item substitutes',
        add: async (workspaceId, clientId) =>
          (
            await tx.db
              .insert(mealItemSubs)
              .values({
                ...mealMacros,
                workspaceId,
                mealItemId: (
                  await tx.db
                    .insert(mealItems)
                    .values(await newMealItem(workspaceId, clientId))
                    .returning({ id: mealItems.id })
                )[0].id,
                sortOrder: 1,
                foodId: await libraryFood(),
                quantity: 1,
                itemName: 'Sub',
              })
              .returning({ id: mealItemSubs.id })
          )[0].id,
        all: () => tx.db.select({ id: mealItemSubs.id }).from(mealItemSubs),
        one: (id) =>
          tx.db
            .select({ id: mealItemSubs.id })
            .from(mealItemSubs)
            .where(eq(mealItemSubs.id, id)),
        change: (id) =>
          tx.db
            .update(mealItemSubs)
            .set({ itemName: 'tampered' })
            .where(eq(mealItemSubs.id, id))
            .returning({ id: mealItemSubs.id }),
        remove: (id) =>
          tx.db
            .delete(mealItemSubs)
            .where(eq(mealItemSubs.id, id))
            .returning({ id: mealItemSubs.id }),
        intruder: async (workspaceId) =>
          tx.db.insert(mealItemSubs).values({
            ...mealMacros,
            workspaceId,
            mealItemId: crypto.randomUUID(),
            sortOrder: 1,
            foodId: await libraryFood(),
            quantity: 1,
            itemName: 'x',
          }),
      },
      {
        name: 'platform subscriptions',
        add: async (workspaceId) =>
          (
            await tx.db
              .insert(platformSubscriptions)
              .values({ workspaceId, ...newPlatformSubscription })
              .returning({ id: platformSubscriptions.id })
          )[0].id,
        all: () =>
          tx.db
            .select({ id: platformSubscriptions.id })
            .from(platformSubscriptions),
        one: (id) =>
          tx.db
            .select({ id: platformSubscriptions.id })
            .from(platformSubscriptions)
            .where(eq(platformSubscriptions.id, id)),
        change: (id) =>
          tx.db
            .update(platformSubscriptions)
            .set({ planId: 'pro' })
            .where(eq(platformSubscriptions.id, id))
            .returning({ id: platformSubscriptions.id }),
        remove: (id) =>
          tx.db
            .delete(platformSubscriptions)
            .where(eq(platformSubscriptions.id, id))
            .returning({ id: platformSubscriptions.id }),
        intruder: (workspaceId) =>
          tx.db
            .insert(platformSubscriptions)
            .values({ workspaceId, ...newPlatformSubscription }),
      },
      {
        name: 'platform invoices',
        add: async (workspaceId) =>
          (
            await tx.db
              .insert(platformInvoices)
              .values({ workspaceId, ...newPlatformInvoice })
              .returning({ id: platformInvoices.id })
          )[0].id,
        all: () =>
          tx.db.select({ id: platformInvoices.id }).from(platformInvoices),
        one: (id) =>
          tx.db
            .select({ id: platformInvoices.id })
            .from(platformInvoices)
            .where(eq(platformInvoices.id, id)),
        change: (id) =>
          tx.db
            .update(platformInvoices)
            .set({ status: InvoiceStatus.PAID })
            .where(eq(platformInvoices.id, id))
            .returning({ id: platformInvoices.id }),
        remove: (id) =>
          tx.db
            .delete(platformInvoices)
            .where(eq(platformInvoices.id, id))
            .returning({ id: platformInvoices.id }),
        intruder: (workspaceId) =>
          tx.db
            .insert(platformInvoices)
            .values({ workspaceId, ...newPlatformInvoice }),
      },
    ];

    beforeAll(async () => {
      clientA = await addClient(workspaceA, 'Hands in A');
      clientB = await addClient(workspaceB, 'Hands in B');
    });

    describe.each(cases)('$name', (c) => {
      let inA: string;
      let inB: string;

      beforeAll(async () => {
        inA = await tx.run(() => c.add(workspaceA, clientA), scopeA());
        inB = await tx.run(() => c.add(workspaceB, clientB), scopeB());
      });

      it('shows only its own inside a scoped transaction', async () => {
        const seen = await tx.run(() => c.all(), scopeA());

        expect(seen).toEqual([{ id: inA }]);
      });

      it('shows nothing outside a scoped transaction, so a forgotten scope leaks nothing', async () => {
        expect(await c.all()).toEqual([]);
      });

      it('shows nothing to a person scope alone', async () => {
        expect(await tx.run(() => c.all(), { personId: personA })).toEqual([]);
      });

      it('cannot read another workspace’s even when asking by id', async () => {
        expect(await tx.run(() => c.one(inB), scopeA())).toEqual([]);
      });

      it('cannot write into another workspace', async () => {
        await expect(
          tx.run(() => c.intruder(workspaceB, clientB), scopeA()),
        ).rejects.toMatchObject({ cause: { code: '42501' } });
      });

      it('cannot update or delete another workspace’s', async () => {
        const touched = await tx.run(async () => {
          const updated = await c.change(inB);
          const deleted = await c.remove(inB);
          return { updated, deleted };
        }, scopeA());

        expect(touched).toEqual({ updated: [], deleted: [] });
        expect(await tx.run(() => c.one(inB), scopeB())).toEqual([{ id: inB }]);
      });
    });

    describe('the secret token of a check-in link', () => {
      let checkinB: string;
      let secretA: string;
      let secretB: string;

      beforeAll(async () => {
        secretA = token();
        secretB = token();
        await tx.run(
          () =>
            tx.db.insert(checkins).values({
              ...newCheckin(workspaceA, clientA),
              dueOn: '2030-02-01',
              token: secretA,
            }),
          scopeA(),
        );
        checkinB = await tx.run(
          async () =>
            (
              await tx.db
                .insert(checkins)
                .values({
                  ...newCheckin(workspaceB, clientB),
                  dueOn: '2030-02-01',
                  token: secretB,
                })
                .returning({ id: checkins.id })
            )[0].id,
          scopeB(),
        );
      });

      it('opens exactly that one check-in, with no workspace at all', async () => {
        const seen = await tx.run(
          () => tx.db.select({ id: checkins.id }).from(checkins),
          { checkinToken: secretB },
        );

        expect(seen).toEqual([{ id: checkinB }]);
      });

      it('opens no other check-in', async () => {
        const seen = await tx.run(
          () => tx.db.select({ token: checkins.token }).from(checkins),
          { checkinToken: secretB },
        );

        expect(seen.every((row) => row.token === secretB)).toBe(true);
      });

      it('opens nothing for a token that is not one, or an empty one', async () => {
        await ['nope-nope', ''].reduce(async (previous, checkinToken) => {
          await previous;

          expect(
            await tx.run(
              () => tx.db.select({ id: checkins.id }).from(checkins),
              { checkinToken },
            ),
          ).toEqual([]);
        }, Promise.resolve());
      });

      it('only reads: it cannot change or remove the check-in', async () => {
        const touched = await tx.run(
          async () => ({
            updated: await tx.db
              .update(checkins)
              .set({ coachReply: 'tampered' })
              .where(eq(checkins.id, checkinB))
              .returning({ id: checkins.id }),
            deleted: await tx.db
              .delete(checkins)
              .where(eq(checkins.id, checkinB))
              .returning({ id: checkins.id }),
          }),
          { checkinToken: secretB },
        );

        expect(touched).toEqual({ updated: [], deleted: [] });
      });

      it('opens nothing else: the client and the rest stay out of reach', async () => {
        const seen = await tx.run(
          async () => ({
            clients: await tx.db.select({ id: clients.id }).from(clients),
            schedules: await tx.db
              .select({ id: checkinSchedules.id })
              .from(checkinSchedules),
            workspaces: await tx.db
              .select({ id: workspaces.id })
              .from(workspaces),
          }),
          { checkinToken: secretB },
        );

        expect(seen).toEqual({ clients: [], schedules: [], workspaces: [] });
      });
    });

    describe('the job that keeps check-ins created', () => {
      let scheduleA: string;
      let scheduleB: string;

      beforeAll(async () => {
        scheduleA = await tx.run(
          async () =>
            (
              await tx.db
                .insert(checkinSchedules)
                .values({ workspaceId: workspaceA, clientId: clientA })
                .onConflictDoUpdate({
                  target: checkinSchedules.clientId,
                  set: { isActive: true },
                })
                .returning({ id: checkinSchedules.id })
            )[0].id,
          scopeA(),
        );
        scheduleB = await tx.run(
          async () =>
            (
              await tx.db
                .insert(checkinSchedules)
                .values({ workspaceId: workspaceB, clientId: clientB })
                .onConflictDoUpdate({
                  target: checkinSchedules.clientId,
                  set: { isActive: true },
                })
                .returning({ id: checkinSchedules.id })
            )[0].id,
          scopeB(),
        );
      });

      it('reads the schedules of every workspace as the system', async () => {
        const seen = await tx.run(
          () =>
            tx.db.select({ id: checkinSchedules.id }).from(checkinSchedules),
          { system: true },
        );

        expect(seen.map((r) => r.id)).toEqual(
          expect.arrayContaining([scheduleA, scheduleB]),
        );
      });

      it('may only read them: it cannot change or remove a schedule', async () => {
        const touched = await tx.run(
          async () => ({
            updated: await tx.db
              .update(checkinSchedules)
              .set({ isActive: false })
              .where(eq(checkinSchedules.id, scheduleB))
              .returning({ id: checkinSchedules.id }),
            deleted: await tx.db
              .delete(checkinSchedules)
              .where(eq(checkinSchedules.id, scheduleB))
              .returning({ id: checkinSchedules.id }),
          }),
          { system: true },
        );

        expect(touched).toEqual({ updated: [], deleted: [] });
      });

      it('cannot read the check-ins themselves', async () => {
        const seen = await tx.run(
          () => tx.db.select({ id: checkins.id }).from(checkins),
          { system: true },
        );

        expect(seen).toEqual([]);
      });
    });

    describe('the platform’s own people', () => {
      it('see every coach’s plan and invoices as the system', async () => {
        const subscriptions = await tx.run(
          () =>
            tx.db
              .select({ workspaceId: platformSubscriptions.workspaceId })
              .from(platformSubscriptions),
          { system: true },
        );
        const invoices = await tx.run(
          () =>
            tx.db
              .select({ workspaceId: platformInvoices.workspaceId })
              .from(platformInvoices),
          { system: true },
        );

        expect(subscriptions.map((r) => r.workspaceId)).toEqual(
          expect.arrayContaining([workspaceA, workspaceB]),
        );
        expect(invoices.map((r) => r.workspaceId)).toEqual(
          expect.arrayContaining([workspaceA, workspaceB]),
        );
      });

      it('can confirm an invoice in any workspace', async () => {
        const marked = await tx.run(
          () =>
            tx.db
              .update(platformInvoices)
              .set({ status: InvoiceStatus.PAID })
              .where(eq(platformInvoices.workspaceId, workspaceB))
              .returning({ id: platformInvoices.id }),
          { system: true },
        );

        expect(marked.length).toBeGreaterThan(0);
      });

      it('reach nothing else of a coach’s: clients and plans stay out of reach', async () => {
        const seen = await tx.run(
          async () => ({
            clients: await tx.db.select({ id: clients.id }).from(clients),
            plans: await tx.db.select({ id: plans.id }).from(plans),
          }),
          { system: true },
        );

        expect(seen).toEqual({ clients: [], plans: [] });
      });
    });

    describe('the sender of reminders', () => {
      let reminderA: string;
      let reminderB: string;

      beforeAll(async () => {
        reminderA = await tx.run(
          async () =>
            (
              await tx.db
                .insert(reminders)
                .values(newReminder(workspaceA, clientA))
                .returning({ id: reminders.id })
            )[0].id,
          scopeA(),
        );
        reminderB = await tx.run(
          async () =>
            (
              await tx.db
                .insert(reminders)
                .values(newReminder(workspaceB, clientB))
                .returning({ id: reminders.id })
            )[0].id,
          scopeB(),
        );
      });

      it('sees the reminders of every workspace when it acts as the system', async () => {
        const seen = await tx.run(
          () => tx.db.select({ id: reminders.id }).from(reminders),
          { system: true },
        );

        expect(seen.map((r) => r.id)).toEqual(
          expect.arrayContaining([reminderA, reminderB]),
        );
      });

      it('can mark a reminder as sent in any workspace', async () => {
        const marked = await tx.run(
          () =>
            tx.db
              .update(reminders)
              .set({ sentAt: new Date() })
              .where(eq(reminders.id, reminderB))
              .returning({ id: reminders.id }),
          { system: true },
        );

        expect(marked).toEqual([{ id: reminderB }]);
      });

      it('reaches nothing but reminders: clients, workspaces and payments stay out of reach', async () => {
        const seen = await tx.run(
          async () => ({
            clients: await tx.db.select({ id: clients.id }).from(clients),
            workspaces: await tx.db
              .select({ id: workspaces.id })
              .from(workspaces),
            payments: await tx.db.select({ id: payments.id }).from(payments),
            subscriptions: await tx.db
              .select({ id: subscriptions.id })
              .from(subscriptions),
          }),
          { system: true },
        );

        expect(seen).toEqual({
          clients: [],
          workspaces: [],
          payments: [],
          subscriptions: [],
        });
      });

      it('is not something a workspace scope can turn on by itself', async () => {
        const seen = await tx.run(
          () => tx.db.select({ id: reminders.id }).from(reminders),
          scopeA(),
        );

        expect(seen.every((r) => r.id !== reminderB)).toBe(true);
      });
    });

    describe('the secret token of an intake link', () => {
      let linkB: string;

      beforeAll(async () => {
        tokenA = token();
        tokenB = token();
        await tx.run(
          () =>
            tx.db.insert(intakeLinks).values({
              workspaceId: workspaceA,
              clientId: clientA,
              token: tokenA,
            }),
          scopeA(),
        );
        linkB = await tx.run(
          async () =>
            (
              await tx.db
                .insert(intakeLinks)
                .values({
                  workspaceId: workspaceB,
                  clientId: clientB,
                  token: tokenB,
                })
                .returning({ id: intakeLinks.id })
            )[0].id,
          scopeB(),
        );
      });

      const readByToken = (presented: string) =>
        tx.run(
          () =>
            tx.db
              .select({
                id: intakeLinks.id,
                workspaceId: intakeLinks.workspaceId,
                clientId: intakeLinks.clientId,
              })
              .from(intakeLinks),
          { intakeToken: presented },
        );

      it('opens exactly that one link, with no workspace at all', async () => {
        expect(await readByToken(tokenB)).toEqual([
          { id: linkB, workspaceId: workspaceB, clientId: clientB },
        ]);
      });

      it('opens no other link', async () => {
        const seen = await readByToken(tokenB);

        expect(seen.map((row) => row.workspaceId)).not.toContain(workspaceA);
      });

      it('opens nothing for a token that is not one', async () => {
        expect(await readByToken(token())).toEqual([]);
      });

      it('opens nothing for an empty token', async () => {
        expect(await readByToken('')).toEqual([]);
      });

      it('only reads: it cannot change or remove the link', async () => {
        const touched = await tx.run(
          async () => {
            const updated = await tx.db
              .update(intakeLinks)
              .set({ submittedAt: new Date() })
              .where(eq(intakeLinks.token, tokenB))
              .returning({ id: intakeLinks.id });
            const deleted = await tx.db
              .delete(intakeLinks)
              .where(eq(intakeLinks.token, tokenB))
              .returning({ id: intakeLinks.id });
            return { updated, deleted };
          },
          { intakeToken: tokenB },
        );

        expect(touched).toEqual({ updated: [], deleted: [] });
      });

      it('opens nothing else: the client and the rest stay out of reach', async () => {
        const seen = await tx.run(
          async () => ({
            clients: await tx.db.select({ id: clients.id }).from(clients),
            responses: await tx.db
              .select({ id: intakeResponses.id })
              .from(intakeResponses),
            workspaces: await tx.db
              .select({ id: workspaces.id })
              .from(workspaces),
          }),
          { intakeToken: tokenB },
        );

        expect(seen).toEqual({ clients: [], responses: [], workspaces: [] });
      });
    });

    describe('the secret token of a program link', () => {
      let programTokenA: string;
      let programTokenB: string;
      let programLinkB: string;

      beforeAll(async () => {
        programTokenA = token();
        programTokenB = token();
        await tx.run(
          () =>
            tx.db.insert(programLinks).values({
              workspaceId: workspaceA,
              clientId: clientA,
              token: programTokenA,
            }),
          scopeA(),
        );
        programLinkB = await tx.run(
          async () =>
            (
              await tx.db
                .insert(programLinks)
                .values({
                  workspaceId: workspaceB,
                  clientId: clientB,
                  token: programTokenB,
                })
                .returning({ id: programLinks.id })
            )[0].id,
          scopeB(),
        );
      });

      const readByToken = (presented: string) =>
        tx.run(
          () =>
            tx.db
              .select({
                id: programLinks.id,
                workspaceId: programLinks.workspaceId,
                clientId: programLinks.clientId,
              })
              .from(programLinks),
          { programToken: presented },
        );

      it('opens exactly that one link, with no workspace at all', async () => {
        expect(await readByToken(programTokenB)).toEqual([
          { id: programLinkB, workspaceId: workspaceB, clientId: clientB },
        ]);
      });

      it('opens no other link', async () => {
        const seen = await readByToken(programTokenB);

        expect(seen.map((row) => row.workspaceId)).not.toContain(workspaceA);
      });

      it('opens nothing for a token that is not one', async () => {
        expect(await readByToken(token())).toEqual([]);
      });

      it('opens nothing for an empty token', async () => {
        expect(await readByToken('')).toEqual([]);
      });

      it('only reads: it cannot change or remove the link', async () => {
        const touched = await tx.run(
          async () => {
            const updated = await tx.db
              .update(programLinks)
              .set({ passwordHash: 'scrypt$x$y' })
              .where(eq(programLinks.token, programTokenB))
              .returning({ id: programLinks.id });
            const deleted = await tx.db
              .delete(programLinks)
              .where(eq(programLinks.token, programTokenB))
              .returning({ id: programLinks.id });
            return { updated, deleted };
          },
          { programToken: programTokenB },
        );

        expect(touched).toEqual({ updated: [], deleted: [] });
      });

      it('opens nothing else: the client, the plans and the workspace stay out of reach', async () => {
        const seen = await tx.run(
          async () => ({
            clients: await tx.db.select({ id: clients.id }).from(clients),
            plans: await tx.db.select({ id: plans.id }).from(plans),
            workspaces: await tx.db
              .select({ id: workspaces.id })
              .from(workspaces),
          }),
          { programToken: programTokenB },
        );

        expect(seen).toEqual({ clients: [], plans: [], workspaces: [] });
      });

      it("a coach sees only their own workspace's link", async () => {
        const seen = await tx.run(
          () => tx.db.select({ id: programLinks.id }).from(programLinks),
          scopeA(),
        );

        expect(seen.every((row) => row.id !== programLinkB)).toBe(true);
      });
    });
  });
  describe('the forms coaches build', () => {
    let templateA: string;
    let templateB: string;

    const addForm = (workspaceId: string) =>
      tx.run(
        async () => {
          const [template] = await tx.db
            .insert(formTemplates)
            .values({ workspaceId, purpose: FormPurpose.INTAKE })
            .returning({ id: formTemplates.id });
          await tx.db.insert(formQuestions).values({
            workspaceId,
            templateId: template.id,
            position: 0,
            labelAr: 'سؤال',
            inputType: QuestionType.SHORT_TEXT,
          });
          return template.id;
        },
        { workspaceId },
      );

    beforeAll(async () => {
      templateA = await addForm(workspaceA);
      templateB = await addForm(workspaceB);
    });

    it('shows a workspace only its own forms and questions', async () => {
      const seen = await tx.run(async () => {
        const templates = await tx.db
          .select({ id: formTemplates.id })
          .from(formTemplates);
        const questions = await tx.db
          .select({ templateId: formQuestions.templateId })
          .from(formQuestions);
        return { templates, questions };
      }, scopeA());

      expect(seen).toEqual({
        templates: [{ id: templateA }],
        questions: [{ templateId: templateA }],
      });
    });

    it('shows nothing outside a scoped transaction', async () => {
      expect(await tx.db.select().from(formTemplates)).toEqual([]);
      expect(await tx.db.select().from(formQuestions)).toEqual([]);
    });

    it('cannot write a form or a question into another workspace', async () => {
      await expect(
        tx.run(async () => {
          await tx.db
            .insert(formTemplates)
            .values({ workspaceId: workspaceB, purpose: FormPurpose.CHECKIN });
        }, scopeA()),
      ).rejects.toMatchObject({ cause: { code: '42501' } });
      await expect(
        tx.run(async () => {
          await tx.db.insert(formQuestions).values({
            workspaceId: workspaceB,
            templateId: templateB,
            position: 1,
            labelAr: 'مدسوس',
            inputType: QuestionType.SHORT_TEXT,
          });
        }, scopeA()),
      ).rejects.toMatchObject({ cause: { code: '42501' } });
    });

    it('cannot attach a question to another workspace’s form, even as its own', async () => {
      await expect(
        tx.run(async () => {
          await tx.db.insert(formQuestions).values({
            workspaceId: workspaceA,
            templateId: templateB,
            position: 1,
            labelAr: 'مدسوس',
            inputType: QuestionType.SHORT_TEXT,
          });
        }, scopeA()),
      ).rejects.toMatchObject({ cause: { code: '23503' } });
    });

    it('cannot change or delete another workspace’s form', async () => {
      const touched = await tx.run(async () => {
        const updated = await tx.db
          .update(formTemplates)
          .set({ isActive: false })
          .where(eq(formTemplates.id, templateB))
          .returning({ id: formTemplates.id });
        const deleted = await tx.db
          .delete(formTemplates)
          .where(eq(formTemplates.id, templateB))
          .returning({ id: formTemplates.id });
        return { updated, deleted };
      }, scopeA());

      expect(touched).toEqual({ updated: [], deleted: [] });
    });

    it('is out of reach of the system scope', async () => {
      const seen = await tx.run(() => tx.db.select().from(formTemplates), {
        system: true,
      });

      expect(seen).toEqual([]);
    });
  });
  describe('the consents of a coach’s clients', () => {
    let clientA: string;
    let clientB: string;

    const addClient = (workspaceId: string) =>
      tx.run(
        async () => {
          const [row] = await tx.db
            .insert(clients)
            .values({
              workspaceId,
              fullName: 'Consent isolation client',
              phone: uniquePhone(),
            })
            .returning({ id: clients.id });
          await tx.db.insert(clientConsents).values({
            workspaceId,
            clientId: row.id,
            type: ClientConsentType.HEALTH_DATA,
            granted: true,
            textVersion: 'test',
            source: ConsentSource.INTAKE_LINK,
          });
          return row.id;
        },
        { workspaceId },
      );

    beforeAll(async () => {
      clientA = await addClient(workspaceA);
      clientB = await addClient(workspaceB);
    });

    it('shows a workspace only its own clients’ consents', async () => {
      const seen = await tx.run(
        () =>
          tx.db
            .select({ clientId: clientConsents.clientId })
            .from(clientConsents),
        scopeA(),
      );

      expect(seen).toEqual([{ clientId: clientA }]);
    });

    it('shows nothing outside a scoped transaction or to the system scope', async () => {
      expect(await tx.db.select().from(clientConsents)).toEqual([]);
      expect(
        await tx.run(() => tx.db.select().from(clientConsents), {
          system: true,
        }),
      ).toEqual([]);
    });

    it('cannot record a consent for another workspace’s client', async () => {
      await expect(
        tx.run(async () => {
          await tx.db.insert(clientConsents).values({
            workspaceId: workspaceB,
            clientId: clientB,
            type: ClientConsentType.DATA_PROCESSING,
            granted: true,
            textVersion: 'test',
            source: ConsentSource.INTAKE_LINK,
          });
        }, scopeA()),
      ).rejects.toMatchObject({ cause: { code: '42501' } });
    });

    it('cannot attach a consent to another workspace’s client even under its own workspace', async () => {
      await expect(
        tx.run(async () => {
          await tx.db.insert(clientConsents).values({
            workspaceId: workspaceA,
            clientId: clientB,
            type: ClientConsentType.DATA_PROCESSING,
            granted: true,
            textVersion: 'test',
            source: ConsentSource.INTAKE_LINK,
          });
        }, scopeA()),
      ).rejects.toMatchObject({ cause: { code: '23503' } });
    });

    it('is a ledger: even its own workspace cannot change or remove a row', async () => {
      const touched = await tx.run(async () => {
        const updated = await tx.db
          .update(clientConsents)
          .set({ granted: false })
          .where(eq(clientConsents.clientId, clientA))
          .returning({ id: clientConsents.id });
        const deleted = await tx.db
          .delete(clientConsents)
          .where(eq(clientConsents.clientId, clientA))
          .returning({ id: clientConsents.id });
        return { updated, deleted };
      }, scopeA());

      expect(touched).toEqual({ updated: [], deleted: [] });
      const still = await tx.run(
        () =>
          tx.db
            .select({ granted: clientConsents.granted })
            .from(clientConsents)
            .where(eq(clientConsents.clientId, clientA)),
        scopeA(),
      );
      expect(still).toEqual([{ granted: true }]);
    });
  });

  describe('the consents of an account holder', () => {
    it('can be written and read for the person, and are removed with them', async () => {
      const [{ id }] = await tx.db
        .insert(people)
        .values({ phone: uniquePhone(), fullName: 'Consent person' })
        .returning({ id: people.id });
      await tx.db.insert(personConsents).values({
        personId: id,
        type: PersonConsentType.TERMS,
        granted: true,
        textVersion: 'test',
        source: ConsentSource.SIGNUP,
      });

      const rows = await tx.db
        .select()
        .from(personConsents)
        .where(eq(personConsents.personId, id));
      await tx.db.delete(people).where(eq(people.id, id));
      const after = await tx.db
        .select()
        .from(personConsents)
        .where(eq(personConsents.personId, id));

      expect(rows).toHaveLength(1);
      expect(after).toEqual([]);
    });
  });
  describe('invitations to join a workspace', () => {
    let invitedPerson: string;
    let invitedPhone: string;
    let invitationA: string;
    let invitationB: string;

    const addInvitation = (workspaceId: string, phone: string) =>
      tx.run(
        async () => {
          const [row] = await tx.db
            .insert(workspaceInvitations)
            .values({
              workspaceId,
              phone,
              brandName: 'Isolation brand',
              expiresAt: new Date(Date.now() + 86_400_000),
            })
            .returning({ id: workspaceInvitations.id });
          return row.id;
        },
        { workspaceId },
      );

    beforeAll(async () => {
      invitedPhone = uniquePhone();
      const [invited] = await tx.db
        .insert(people)
        .values({ phone: invitedPhone, fullName: 'Invited person' })
        .returning({ id: people.id });
      invitedPerson = invited.id;
      invitationA = await addInvitation(workspaceA, uniquePhone());
      invitationB = await addInvitation(workspaceB, invitedPhone);
    });

    afterAll(async () => {
      await tx.db.delete(people).where(eq(people.id, invitedPerson));
    });

    it('shows a workspace only its own invitations', async () => {
      const seen = await tx.run(
        () =>
          tx.db
            .select({ id: workspaceInvitations.id })
            .from(workspaceInvitations),
        scopeA(),
      );

      expect(seen).toEqual([{ id: invitationA }]);
    });

    it('shows nothing outside a scoped transaction', async () => {
      expect(await tx.db.select().from(workspaceInvitations)).toEqual([]);
    });

    it('shows a person the invitations addressed to their own number, from any workspace, and nothing else', async () => {
      const mine = await tx.run(
        () =>
          tx.db
            .select({ id: workspaceInvitations.id })
            .from(workspaceInvitations),
        { personId: invitedPerson },
      );
      const someoneElses = await tx.run(
        () => tx.db.select().from(workspaceInvitations),
        { personId: personA },
      );

      expect(mine).toEqual([{ id: invitationB }]);
      expect(someoneElses).toEqual([]);
    });

    it('lets that person read an invitation but never change or remove it', async () => {
      const touched = await tx.run(
        async () => {
          const updated = await tx.db
            .update(workspaceInvitations)
            .set({ status: InvitationStatus.ACCEPTED })
            .where(eq(workspaceInvitations.id, invitationB))
            .returning({ id: workspaceInvitations.id });
          const deleted = await tx.db
            .delete(workspaceInvitations)
            .where(eq(workspaceInvitations.id, invitationB))
            .returning({ id: workspaceInvitations.id });
          return { updated, deleted };
        },
        { personId: invitedPerson },
      );

      expect(touched).toEqual({ updated: [], deleted: [] });
    });

    it('cannot write an invitation into another workspace', async () => {
      await expect(
        tx.run(async () => {
          await tx.db.insert(workspaceInvitations).values({
            workspaceId: workspaceB,
            phone: uniquePhone(),
            brandName: 'Smuggled',
            expiresAt: new Date(Date.now() + 86_400_000),
          });
        }, scopeA()),
      ).rejects.toMatchObject({ cause: { code: '42501' } });
    });

    it('cannot change or remove another workspace’s invitation', async () => {
      const touched = await tx.run(async () => {
        const updated = await tx.db
          .update(workspaceInvitations)
          .set({ status: InvitationStatus.REVOKED })
          .where(eq(workspaceInvitations.id, invitationB))
          .returning({ id: workspaceInvitations.id });
        const deleted = await tx.db
          .delete(workspaceInvitations)
          .where(eq(workspaceInvitations.id, invitationB))
          .returning({ id: workspaceInvitations.id });
        return { updated, deleted };
      }, scopeA());

      expect(touched).toEqual({ updated: [], deleted: [] });
    });

    it('is out of reach of the system scope', async () => {
      expect(
        await tx.run(() => tx.db.select().from(workspaceInvitations), {
          system: true,
        }),
      ).toEqual([]);
    });

    it('holds a person to one place in a workspace, whatever the role', async () => {
      await expect(
        tx.run(async () => {
          await tx.db.insert(workspaceMembers).values({
            workspaceId: workspaceB,
            personId: personA,
            role: WorkspaceRole.COACH,
          });
        }, scopeB()),
      ).rejects.toMatchObject({ cause: { code: '23505' } });
    });

    it('lets one person own a workspace and assist in another', async () => {
      const rows = await tx.run(
        () =>
          tx.db
            .select({
              workspaceId: workspaceMembers.workspaceId,
              role: workspaceMembers.role,
              isOwner: workspaceMembers.isOwner,
            })
            .from(workspaceMembers),
        { personId: personA },
      );

      expect(rows).toEqual(
        expect.arrayContaining([
          { workspaceId: workspaceA, role: 'coach', isOwner: true },
          { workspaceId: workspaceB, role: 'assistant', isOwner: false },
        ]),
      );
    });
  });
  describe('nutrition v2 tables', () => {
    type Fixture = {
      workspaceId: string;
      foodId: string;
      recipeId: string;
      nutrientId: string;
    };
    let a: Fixture;
    let b: Fixture;
    const fixture = async (workspaceId: string): Promise<Fixture> => {
      const [food] = await tx.db
        .insert(foods)
        .values({
          workspaceId,
          nameAr: 'Nutrition isolation',
          category: FoodCategory.PROTEIN,
          caloriesKcalPer100g: 100,
          proteinGPer100g: 20,
          carbsGPer100g: 5,
          fatGPer100g: 0,
        })
        .returning({ id: foods.id });
      const [recipe] = await tx.db
        .insert(recipes)
        .values({
          workspaceId,
          nameAr: 'Recipe isolation',
          finishedWeightG: 100,
          origin: RecipeOrigin.USER,
          caloriesKcalPer100g: 100,
          proteinGPer100g: 20,
          carbsGPer100g: 5,
          fatGPer100g: 0,
          fiberGPer100g: 0,
        })
        .returning({ id: recipes.id });
      const [nutrient] = await tx.db
        .select({ id: nutrients.id })
        .from(nutrients)
        .where(eq(nutrients.code, 'sodium'));
      return {
        workspaceId,
        foodId: food.id,
        recipeId: recipe.id,
        nutrientId: nutrient.id,
      };
    };
    beforeAll(async () => {
      a = await tx.run(() => fixture(workspaceA), scopeA());
      b = await tx.run(() => fixture(workspaceB), scopeB());
    });
    it('enables and forces RLS on every new table', async () => {
      const names = [
        'nutrients',
        'food_nutrients',
        'food_aliases',
        'food_publication_requests',
        'recipes',
        'recipe_ingredients',
        'recipe_steps',
        'recipe_portions',
        'recipe_aliases',
      ];
      const result = await tx.db.execute<{
        relname: string;
        relrowsecurity: boolean;
        relforcerowsecurity: boolean;
      }>(
        sql`select relname, relrowsecurity, relforcerowsecurity from pg_class where relnamespace = 'public'::regnamespace and relname in (${sql.join(
          names.map((name) => sql`${name}`),
          sql`, `,
        )})`,
      );
      expect(result.rows).toHaveLength(names.length);
      expect(
        result.rows.every(
          (row) => row.relrowsecurity && row.relforcerowsecurity,
        ),
      ).toBe(true);
    });
    it('reads the seven immutable nutrients without a workspace', async () => {
      const rows = await tx.db.select().from(nutrients);
      expect(rows.map((row) => row.code).sort()).toEqual(
        [
          'sugars',
          'saturated_fat',
          'sodium',
          'calcium',
          'iron',
          'potassium',
          'vitamin_c',
        ].sort(),
      );
      expect(
        await tx.run(
          () => tx.db.update(nutrients).set({ sortOrder: 999 }).returning(),
          scopeA(),
        ),
      ).toEqual([]);
      expect(
        await tx.run(() => tx.db.delete(nutrients).returning(), scopeA()),
      ).toEqual([]);
      await expect(
        tx.run(
          () =>
            tx.db.insert(nutrients).values({
              code: 'test_nutrient',
              nameAr: 'x',
              nameEn: 'x',
              measureUnit: rows[0].measureUnit,
            }),
          scopeA(),
        ),
      ).rejects.toMatchObject({ cause: { code: '42501' } });
    });
    const cases = [
      {
        name: 'food_nutrients',
        add: async (f: Fixture) =>
          (
            await tx.db
              .insert(foodNutrients)
              .values({
                foodId: f.foodId,
                workspaceId: f.workspaceId,
                nutrientId: f.nutrientId,
                amountPer100g: 0,
              })
              .returning({ id: foodNutrients.foodId })
          )[0].id,
        read: (id: string) =>
          tx.db
            .select({ id: foodNutrients.foodId })
            .from(foodNutrients)
            .where(eq(foodNutrients.foodId, id)),
        change: (id: string) =>
          tx.db
            .update(foodNutrients)
            .set({ amountPer100g: 3 })
            .where(eq(foodNutrients.foodId, id))
            .returning({ id: foodNutrients.foodId }),
        remove: (id: string) =>
          tx.db
            .delete(foodNutrients)
            .where(eq(foodNutrients.foodId, id))
            .returning({ id: foodNutrients.foodId }),
      },
      {
        name: 'food_aliases',
        add: async (f: Fixture) =>
          (
            await tx.db
              .insert(foodAliases)
              .values({
                foodId: f.foodId,
                workspaceId: f.workspaceId,
                kind: NutritionAliasKind.ALIAS_EN,
                alias: 'isolation',
              })
              .returning({ id: foodAliases.id })
          )[0].id,
        read: (id: string) =>
          tx.db
            .select({ id: foodAliases.id })
            .from(foodAliases)
            .where(eq(foodAliases.id, id)),
        change: (id: string) =>
          tx.db
            .update(foodAliases)
            .set({ alias: 'tampered' })
            .where(eq(foodAliases.id, id))
            .returning({ id: foodAliases.id }),
        remove: (id: string) =>
          tx.db
            .delete(foodAliases)
            .where(eq(foodAliases.id, id))
            .returning({ id: foodAliases.id }),
      },
      {
        name: 'food_publication_requests',
        add: async (f: Fixture) =>
          (
            await tx.db
              .insert(foodPublicationRequests)
              .values({ foodId: f.foodId, workspaceId: f.workspaceId })
              .returning({ id: foodPublicationRequests.id })
          )[0].id,
        read: (id: string) =>
          tx.db
            .select({ id: foodPublicationRequests.id })
            .from(foodPublicationRequests)
            .where(eq(foodPublicationRequests.id, id)),
        change: (id: string) =>
          tx.db
            .update(foodPublicationRequests)
            .set({ reviewerNote: 'tampered' })
            .where(eq(foodPublicationRequests.id, id))
            .returning({ id: foodPublicationRequests.id }),
        remove: (id: string) =>
          tx.db
            .delete(foodPublicationRequests)
            .where(eq(foodPublicationRequests.id, id))
            .returning({ id: foodPublicationRequests.id }),
      },
      {
        name: 'recipes',
        add: async (f: Fixture) =>
          (
            await tx.db
              .insert(recipes)
              .values({
                workspaceId: f.workspaceId,
                nameAr: 'Another recipe',
                finishedWeightG: 100,
                origin: RecipeOrigin.USER,
                caloriesKcalPer100g: 100,
                proteinGPer100g: 20,
                carbsGPer100g: 5,
                fatGPer100g: 0,
                fiberGPer100g: 0,
              })
              .returning({ id: recipes.id })
          )[0].id,
        read: (id: string) =>
          tx.db
            .select({ id: recipes.id })
            .from(recipes)
            .where(eq(recipes.id, id)),
        change: (id: string) =>
          tx.db
            .update(recipes)
            .set({ nameAr: 'tampered' })
            .where(eq(recipes.id, id))
            .returning({ id: recipes.id }),
        remove: (id: string) =>
          tx.db
            .delete(recipes)
            .where(eq(recipes.id, id))
            .returning({ id: recipes.id }),
      },
      {
        name: 'recipe_ingredients',
        add: async (f: Fixture) =>
          (
            await tx.db
              .insert(recipeIngredients)
              .values({
                recipeId: f.recipeId,
                workspaceId: f.workspaceId,
                sortOrder: 1,
                foodId: f.foodId,
                weightG: 100,
              })
              .returning({ id: recipeIngredients.id })
          )[0].id,
        read: (id: string) =>
          tx.db
            .select({ id: recipeIngredients.id })
            .from(recipeIngredients)
            .where(eq(recipeIngredients.id, id)),
        change: (id: string) =>
          tx.db
            .update(recipeIngredients)
            .set({ noteAr: 'tampered' })
            .where(eq(recipeIngredients.id, id))
            .returning({ id: recipeIngredients.id }),
        remove: (id: string) =>
          tx.db
            .delete(recipeIngredients)
            .where(eq(recipeIngredients.id, id))
            .returning({ id: recipeIngredients.id }),
      },
      {
        name: 'recipe_steps',
        add: async (f: Fixture) =>
          (
            await tx.db
              .insert(recipeSteps)
              .values({
                recipeId: f.recipeId,
                workspaceId: f.workspaceId,
                sortOrder: 1,
                instruction: 'Mix',
              })
              .returning({ id: recipeSteps.id })
          )[0].id,
        read: (id: string) =>
          tx.db
            .select({ id: recipeSteps.id })
            .from(recipeSteps)
            .where(eq(recipeSteps.id, id)),
        change: (id: string) =>
          tx.db
            .update(recipeSteps)
            .set({ instruction: 'tampered' })
            .where(eq(recipeSteps.id, id))
            .returning({ id: recipeSteps.id }),
        remove: (id: string) =>
          tx.db
            .delete(recipeSteps)
            .where(eq(recipeSteps.id, id))
            .returning({ id: recipeSteps.id }),
      },
      {
        name: 'recipe_portions',
        add: async (f: Fixture) =>
          (
            await tx.db
              .insert(recipePortions)
              .values({
                recipeId: f.recipeId,
                workspaceId: f.workspaceId,
                sortOrder: 1,
                nameAr: 'Plate',
                weightG: 100,
                isDefault: true,
              })
              .returning({ id: recipePortions.id })
          )[0].id,
        read: (id: string) =>
          tx.db
            .select({ id: recipePortions.id })
            .from(recipePortions)
            .where(eq(recipePortions.id, id)),
        change: (id: string) =>
          tx.db
            .update(recipePortions)
            .set({ nameAr: 'tampered' })
            .where(eq(recipePortions.id, id))
            .returning({ id: recipePortions.id }),
        remove: (id: string) =>
          tx.db
            .delete(recipePortions)
            .where(eq(recipePortions.id, id))
            .returning({ id: recipePortions.id }),
      },
      {
        name: 'recipe_aliases',
        add: async (f: Fixture) =>
          (
            await tx.db
              .insert(recipeAliases)
              .values({
                recipeId: f.recipeId,
                workspaceId: f.workspaceId,
                kind: NutritionAliasKind.ALIAS_EN,
                alias: 'recipe isolation',
              })
              .returning({ id: recipeAliases.id })
          )[0].id,
        read: (id: string) =>
          tx.db
            .select({ id: recipeAliases.id })
            .from(recipeAliases)
            .where(eq(recipeAliases.id, id)),
        change: (id: string) =>
          tx.db
            .update(recipeAliases)
            .set({ alias: 'tampered' })
            .where(eq(recipeAliases.id, id))
            .returning({ id: recipeAliases.id }),
        remove: (id: string) =>
          tx.db
            .delete(recipeAliases)
            .where(eq(recipeAliases.id, id))
            .returning({ id: recipeAliases.id }),
      },
    ];
    describe.each(cases)('$name isolation', (entry) => {
      let idA: string;
      let idB: string;
      beforeAll(async () => {
        idA = await tx.run(() => entry.add(a), scopeA());
        idB = await tx.run(() => entry.add(b), scopeB());
      });
      it('reads its own rows and hides them from unscoped and other workspace queries', async () => {
        expect(await tx.run(() => entry.read(idA), scopeA())).toEqual([
          { id: idA },
        ]);
        expect(await tx.run(() => entry.read(idB), scopeB())).toEqual([
          { id: idB },
        ]);
        expect(await entry.read(idA)).toEqual([]);
        expect(await tx.run(() => entry.read(idA), scopeB())).toEqual([]);
      });
      it('refuses writing into another workspace', async () => {
        await expect(
          tx.run(() => entry.add(b), scopeA()),
        ).rejects.toMatchObject({ cause: { code: '42501' } });
      });
      it('cannot update or delete another workspace rows', async () => {
        expect(await tx.run(() => entry.change(idA), scopeB())).toEqual([]);
        expect(await tx.run(() => entry.remove(idA), scopeB())).toEqual([]);
        expect(await tx.run(() => entry.read(idA), scopeA())).toEqual([
          { id: idA },
        ]);
      });
    });
    it('uses triggers for names and aliases, even when a caller supplies the search fields', async () => {
      await tx.run(async () => {
        const [food] = await tx.db
          .update(foods)
          .set({
            nameAr: 'WHEY',
            nameEn: 'Protein',
            brand: 'BRAND',
            searchName: 'wrong',
          })
          .where(eq(foods.id, a.foodId))
          .returning();
        expect(food.searchName).toBe('whey protein brand');
        const [recipe] = await tx.db
          .update(recipes)
          .set({ nameAr: 'WHEY', nameEn: 'Shake', searchName: 'wrong' })
          .where(eq(recipes.id, a.recipeId))
          .returning();
        expect(recipe.searchName).toBe('whey shake');
        const [alias] = await tx.db
          .update(foodAliases)
          .set({ alias: '  WHEY  ', searchAlias: 'wrong' })
          .where(eq(foodAliases.foodId, a.foodId))
          .returning();
        expect(alias.searchAlias).toBe('whey');
        const [recipeAlias] = await tx.db
          .update(recipeAliases)
          .set({ alias: '  SHAKE  ', searchAlias: 'wrong' })
          .where(eq(recipeAliases.recipeId, a.recipeId))
          .returning();
        expect(recipeAlias.searchAlias).toBe('shake');
      }, scopeA());
    });
    it('allows shared and own ingredients and refuses another workspace food', async () => {
      const [shared] = await tx.db
        .select({ id: foods.id })
        .from(foods)
        .where(sql`${foods.workspaceId} is null`)
        .limit(1);
      await tx.run(async () => {
        await tx.db.insert(recipeIngredients).values([
          {
            workspaceId: workspaceA,
            recipeId: a.recipeId,
            foodId: shared.id,
            sortOrder: 10,
            weightG: 100,
          },
          {
            workspaceId: workspaceA,
            recipeId: a.recipeId,
            foodId: a.foodId,
            sortOrder: 11,
            weightG: 100,
          },
        ]);
      }, scopeA());
      await expect(
        tx.run(
          () =>
            tx.db.insert(recipeIngredients).values({
              workspaceId: workspaceA,
              recipeId: a.recipeId,
              foodId: b.foodId,
              sortOrder: 12,
              weightG: 100,
            }),
          scopeA(),
        ),
      ).rejects.toMatchObject({ cause: { code: '42501' } });
    });
    it('enforces the chosen food or recipe and its portion for items and substitutes', async () => {
      const parents = await tx.run(async () => {
        const [plan] = await tx.db
          .insert(mealPlans)
          .values({
            workspaceId: workspaceA,
            isTemplate: true,
            name: 'Nutrition constraints',
          })
          .returning();
        const [meal] = await tx.db
          .insert(meals)
          .values({
            workspaceId: workspaceA,
            mealPlanId: plan.id,
            weekday: null,
            sortOrder: 1,
            name: 'Lunch',
          })
          .returning();
        const [foodPortion] = await tx.db
          .insert(foodPortions)
          .values({
            workspaceId: workspaceA,
            foodId: a.foodId,
            nameAr: 'Piece',
            weightG: 50,
          })
          .returning();
        const [recipePortion] = await tx.db
          .insert(recipePortions)
          .values({
            workspaceId: workspaceA,
            recipeId: a.recipeId,
            nameAr: 'Serving',
            weightG: 100,
          })
          .returning();
        const [item] = await tx.db
          .insert(mealItems)
          .values({
            workspaceId: workspaceA,
            mealId: meal.id,
            recipeId: a.recipeId,
            portionId: recipePortion.id,
            sortOrder: 1,
            quantity: 1,
            itemName: 'Recipe',
            weightG: 100,
            caloriesKcal: 100,
            proteinG: 20,
            carbsG: 5,
            fatG: 0,
          })
          .returning();
        return { meal, foodPortion, recipePortion, item };
      }, scopeA());
      const nutrition = {
        workspaceId: workspaceA,
        quantity: 1,
        itemName: 'Snapshot',
        weightG: 100,
        caloriesKcal: 100,
        proteinG: 20,
        carbsG: 5,
        fatG: 0,
      };
      const addItem = (choice: {
        foodId?: string;
        recipeId?: string;
        portionId?: string;
      }) =>
        tx.run(
          () =>
            tx.db.insert(mealItems).values({
              ...nutrition,
              mealId: parents.meal.id,
              sortOrder: 2,
              ...choice,
            }),
          scopeA(),
        );
      const addSub = (choice: {
        foodId?: string;
        recipeId?: string;
        portionId?: string;
      }) =>
        tx.run(
          () =>
            tx.db.insert(mealItemSubs).values({
              ...nutrition,
              mealItemId: parents.item.id,
              sortOrder: 1,
              ...choice,
            }),
          scopeA(),
        );
      await Promise.all(
        [addItem, addSub].map(async (add) => {
          await expect(add({})).rejects.toMatchObject({
            cause: { code: '23514' },
          });
          await expect(
            add({ foodId: a.foodId, recipeId: a.recipeId }),
          ).rejects.toMatchObject({ cause: { code: '23514' } });
          await expect(
            add({ foodId: a.foodId, portionId: parents.recipePortion.id }),
          ).rejects.toMatchObject({ cause: { code: '23503' } });
          await expect(
            add({ recipeId: a.recipeId, portionId: parents.foodPortion.id }),
          ).rejects.toMatchObject({ cause: { code: '23503' } });
          await add({ foodId: a.foodId, portionId: parents.foodPortion.id });
        }),
      );
      await tx.run(
        () =>
          tx.db
            .delete(foodPortions)
            .where(eq(foodPortions.id, parents.foodPortion.id)),
        scopeA(),
      );
      const [saved] = await tx.run(
        () =>
          tx.db
            .select()
            .from(mealItems)
            .where(eq(mealItems.mealId, parents.meal.id))
            .orderBy(mealItems.sortOrder),
        scopeA(),
      );
      expect(saved.recipeId).toBe(a.recipeId);
      const [foodItem] = await tx.run(
        () =>
          tx.db
            .select()
            .from(mealItems)
            .where(
              and(
                eq(mealItems.mealId, parents.meal.id),
                eq(mealItems.sortOrder, 2),
              ),
            ),
        scopeA(),
      );
      expect(foodItem).toMatchObject({
        foodId: a.foodId,
        portionId: null,
        caloriesKcal: 100,
      });
      await expect(
        tx.run(
          () =>
            tx.db.insert(meals).values({
              workspaceId: workspaceA,
              mealPlanId: parents.meal.mealPlanId,
              weekday: null,
              sortOrder: 1,
              name: 'Duplicate everyday',
            }),
          scopeA(),
        ),
      ).rejects.toMatchObject({ cause: { code: '23505' } });
    });
    it('lets only the system review publication requests across workspaces', async () => {
      const [request] = await tx.run(
        () =>
          tx.db
            .select()
            .from(foodPublicationRequests)
            .where(eq(foodPublicationRequests.foodId, a.foodId)),
        scopeA(),
      );
      expect(
        await tx.run(
          () =>
            tx.db
              .update(foodPublicationRequests)
              .set({ status: FoodPublicationStatus.APPROVED })
              .where(eq(foodPublicationRequests.id, request.id))
              .returning(),
          scopeA(),
        ),
      ).toEqual([]);
      const reviewed = await tx.run(
        () =>
          tx.db
            .update(foodPublicationRequests)
            .set({
              status: FoodPublicationStatus.APPROVED,
              reviewedBy: personA,
              reviewedAt: new Date(),
            })
            .where(eq(foodPublicationRequests.id, request.id))
            .returning(),
        { system: true },
      );
      expect(reviewed[0].status).toBe(FoodPublicationStatus.APPROVED);
    });
  });
});
