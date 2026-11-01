import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import {
  foodAliases,
  foodPortions,
  foods,
  platformAdmins,
} from '../src/database/schema';
import { FoodCategory } from '../src/foods/enums/food-category.enum';
import { NutritionAliasKind } from '../src/foods/enums/nutrition-alias-kind.enum';
import { HttpTestApp, type TestSession } from './support/http-test-app';

jest.setTimeout(60_000);

describe('Food publication review over HTTP', () => {
  let harness: HttpTestApp;
  let admin: TestSession;
  const sharedNames: string[] = [];

  beforeAll(async () => {
    harness = await HttpTestApp.start();
    const { body, session } = await harness.signedUpPerson();
    const person = await harness.personRow(body.phone as string);
    await harness.tx.db.insert(platformAdmins).values({ personId: person.id });
    admin = session;
  });

  afterAll(async () => {
    try {
      if (sharedNames.length) {
        await harness.tx.run(async () => {
          await harness.tx.db.execute(
            sql`alter table foods no force row level security; alter table food_portions no force row level security; alter table food_nutrients no force row level security; alter table food_aliases no force row level security`,
          );
          await harness.tx.db.execute(
            sql`delete from foods where workspace_id is null and name_ar in (${sql.join(
              sharedNames.map((name) => sql`${name}`),
              sql`, `,
            )})`,
          );
          await harness.tx.db.execute(
            sql`set constraints all immediate; alter table foods force row level security; alter table food_portions force row level security; alter table food_nutrients force row level security; alter table food_aliases force row level security`,
          );
        });
      }
    } finally {
      await harness.stop();
    }
  }, 60_000);

  const newCoach = async () => {
    const { session } = await harness.signedUpPerson();
    const response = await harness
      .as(session)
      .post('/workspaces')
      .send({ brandName: 'Publication Gym' });
    harness.trackWorkspace(response.body.id);
    expect(response.status).toBe(201);
    return session;
  };

  const addFood = async (session: TestSession) => {
    const response = await harness
      .as(session)
      .post('/foods')
      .send({
        nameAr: `Publication ${randomUUID()}`,
        category: 'protein',
        origin: 'package_label',
        caloriesKcalPer100g: 100,
        proteinGPer100g: 20,
        carbsGPer100g: 5,
        fatGPer100g: 0,
        fiberGPer100g: 1,
        portions: [{ nameAr: 'حصة', weightG: 40 }],
        nutrients: [{ code: 'sodium', amount: 7 }],
        aliases: [{ kind: 'alias_en', alias: 'publication test alias' }],
        confirmNotDuplicate: true,
      })
      .expect(201);
    return response.body as { id: string; nameAr: string };
  };

  const request = (session: TestSession, id: string) =>
    harness.as(session).post(`/foods/${id}/publication-requests`);
  const review = (
    id: string,
    action: string,
    body: Record<string, unknown> = {},
  ) =>
    harness
      .as(admin)
      .post(`/admin/food-publication-requests/${id}/${action}`)
      .send(body);

  it('ranks shared verified before own before shared unverified within the same relevance tier and rejects a shared barcode', async () => {
    const coach = await newCoach();
    const term = `ranking-${randomUUID()}`;
    const own = await harness
      .as(coach)
      .post('/foods')
      .send({
        nameAr: `${term} own`,
        category: 'protein',
        caloriesKcalPer100g: 100,
        proteinGPer100g: 20,
        carbsGPer100g: 5,
        fatGPer100g: 0,
        fiberGPer100g: 0,
        aliases: [{ kind: 'alias_en', alias: term }],
        confirmNotDuplicate: true,
      })
      .expect(201);
    const verifiedName = `${term} verified`;
    const unverifiedName = `${term} unverified`;
    sharedNames.push(verifiedName, unverifiedName);
    const shared = await harness.tx.run(
      async () => {
        const values = {
          category: FoodCategory.PROTEIN,
          caloriesKcalPer100g: 100,
          proteinGPer100g: 20,
          carbsGPer100g: 5,
          fatGPer100g: 0,
        };
        const rows = await harness.tx.db
          .insert(foods)
          .values([
            { ...values, nameAr: verifiedName, isVerified: true },
            { ...values, nameAr: unverifiedName, barcode: '96385074' },
          ])
          .returning({ id: foods.id, isVerified: foods.isVerified });
        await harness.tx.db.insert(foodAliases).values(
          rows.map((food) => ({
            foodId: food.id,
            kind: NutritionAliasKind.ALIAS_EN,
            alias: term,
          })),
        );
        await harness.tx.db.insert(foodPortions).values(
          rows.map((food) => ({
            foodId: food.id,
            nameAr: 'Test serving',
            weightG: 50,
            isDefault: true,
          })),
        );
        return rows;
      },
      { system: true },
    );
    const verified = shared.find((food) => food.isVerified)!.id;
    const unverified = shared.find((food) => !food.isVerified)!.id;
    const all = await harness
      .as(coach)
      .get('/foods')
      .query({ q: term })
      .expect(200);
    expect(all.body.items.map((food: { id: string }) => food.id)).toEqual([
      verified,
      own.body.id,
      unverified,
    ]);
    const onlyShared = await harness
      .as(coach)
      .get('/foods')
      .query({ q: term, scope: 'shared' })
      .expect(200);
    expect(
      onlyShared.body.items.map((food: { id: string }) => food.id),
    ).toEqual([verified, unverified]);
    const duplicate = await harness
      .as(coach)
      .post('/foods')
      .send({
        nameAr: 'Different label',
        category: 'protein',
        caloriesKcalPer100g: 100,
        proteinGPer100g: 20,
        carbsGPer100g: 5,
        fatGPer100g: 0,
        fiberGPer100g: 0,
        barcode: '96385074',
        confirmNotDuplicate: true,
      })
      .expect(409);
    expect(duplicate.body).toMatchObject({
      code: 'FOOD_BARCODE_EXISTS',
      details: { id: unverified },
    });
  });

  it('requests only own active foods, detects duplicate requests and lists only this workspace', async () => {
    const coach = await newCoach();
    const other = await newCoach();
    const food = await addFood(coach);
    const pending = await request(coach, food.id).expect(201);
    expect(pending.body.status).toBe('pending');
    expect((await request(coach, food.id).expect(409)).body.code).toBe(
      'FOOD_PUBLICATION_ALREADY_REQUESTED',
    );
    expect(
      (
        await harness
          .as(coach)
          .get('/food-publication-requests?limit=1')
          .expect(200)
      ).body,
    ).toMatchObject({
      total: 1,
      items: [
        expect.objectContaining({
          id: pending.body.id,
          food: expect.objectContaining({ id: food.id }),
        }),
      ],
    });
    expect(
      (await harness.as(other).get('/food-publication-requests').expect(200))
        .body.total,
    ).toBe(0);
    await request(other, food.id).expect(404);
    const shared = (
      await harness
        .as(coach)
        .get('/foods?scope=shared&q=tomato&limit=1')
        .expect(200)
    ).body.items[0];
    expect((await request(coach, shared.id).expect(403)).body.code).toBe(
      'FOOD_NOT_EDITABLE',
    );
    const inactive = await addFood(coach);
    await harness
      .as(coach)
      .patch(`/foods/${inactive.id}`)
      .send({ isActive: false })
      .expect(200);
    expect((await request(coach, inactive.id).expect(422)).body.code).toBe(
      'INVALID_FOOD',
    );
  });

  it('lets a platform admin review food details and creates a shared copy visible to a different workspace', async () => {
    const coach = await newCoach();
    const other = await newCoach();
    const food = await addFood(coach);
    const pending = await request(coach, food.id).expect(201);
    const page = await harness
      .as(admin)
      .get('/admin/food-publication-requests?status=pending&limit=100')
      .expect(200);
    const row = (
      page.body.items as {
        id: string;
        coachBrandName: string;
        food: {
          portions: unknown[];
          nutrients: unknown[];
          aliases: { alias_en: string[] };
        };
      }[]
    ).find((item) => item.id === pending.body.id)!;
    expect(row.coachBrandName).toBe('Publication Gym');
    expect(row.food.portions).toHaveLength(1);
    expect(row.food.nutrients).toHaveLength(1);
    expect(row.food.aliases.alias_en).toEqual(['publication test alias']);
    sharedNames.push(food.nameAr);
    const approved = await review(pending.body.id, 'approve', {
      note: 'Reviewed label',
    }).expect(201);
    expect(approved.body).toMatchObject({
      status: 'approved',
      reviewerNote: 'Reviewed label',
      sharedFoodId: expect.any(String),
    });
    const shared = await harness
      .as(other)
      .get(`/foods/${approved.body.sharedFoodId}`)
      .expect(200);
    expect(shared.body).toMatchObject({
      nameAr: food.nameAr,
      slug: null,
      isOwn: false,
      isCustom: false,
      origin: 'package_label',
      confidence: 'low',
      isVerified: false,
      caloriesKcalPer100g: 100,
    });
    expect(shared.body.originNote).toContain(
      `Suggested by a coach, approved on ${new Date().toISOString().slice(0, 10)}`,
    );
    expect(shared.body.portions).toHaveLength(1);
    expect(shared.body.nutrients[0]).toMatchObject({
      code: 'sodium',
      amountPer100g: 7,
    });
    expect(shared.body.aliases.alias_en).toEqual(['publication test alias']);
    const privateFood = await harness
      .as(coach)
      .get(`/foods/${food.id}`)
      .expect(200);
    expect(privateFood.body).toMatchObject({
      isOwn: true,
      originNote: 'manual',
    });
    expect(privateFood.body.portions[0].id).not.toBe(
      shared.body.portions[0].id,
    );
    expect(
      (
        await review(pending.body.id, 'reject', { note: 'too late' }).expect(
          409,
        )
      ).body.code,
    ).toBe('FOOD_PUBLICATION_NOT_PENDING');
  });

  it('requires rejection notes, records duplicate targets only when shared, and allows a new request after rejection', async () => {
    const coach = await newCoach();
    const food = await addFood(coach);
    const pending = await request(coach, food.id).expect(201);
    await review(pending.body.id, 'reject').expect(400);
    await review(pending.body.id, 'reject', { note: '  ' }).expect(400);
    expect(
      (
        await review(pending.body.id, 'reject', {
          note: 'Cannot verify label',
        }).expect(201)
      ).body.status,
    ).toBe('rejected');
    const again = await request(coach, food.id).expect(201);
    expect(
      (
        await review(again.body.id, 'duplicate', {
          duplicateOfFoodId: food.id,
        }).expect(422)
      ).body.code,
    ).toBe('INVALID_FOOD');
    const shared = (
      await harness
        .as(coach)
        .get('/foods?scope=shared&q=tomato&limit=1')
        .expect(200)
    ).body.items[0];
    expect(
      (
        await review(again.body.id, 'duplicate', {
          duplicateOfFoodId: shared.id,
          note: 'Already in library',
        }).expect(201)
      ).body,
    ).toMatchObject({ status: 'duplicate', duplicateOfFoodId: shared.id });
  });

  it('lets only one simultaneous decision win and creates only one shared copy', async () => {
    const coach = await newCoach();
    const food = await addFood(coach);
    const pending = await request(coach, food.id).expect(201);
    sharedNames.push(food.nameAr);
    const results = await Promise.all([
      review(pending.body.id, 'approve'),
      review(pending.body.id, 'approve'),
    ]);
    expect(
      results.map((result) => result.status).sort((a, b) => a - b),
    ).toEqual([201, 409]);
    expect(results.find((result) => result.status === 409)!.body.code).toBe(
      'FOOD_PUBLICATION_NOT_PENDING',
    );
    const rows = await harness
      .as(coach)
      .get('/foods')
      .query({ scope: 'shared', q: food.nameAr })
      .expect(200);
    expect(
      rows.body.items.filter(
        (item: { nameAr: string }) => item.nameAr === food.nameAr,
      ),
    ).toHaveLength(1);
  });

  it('refuses normal coaches at every platform endpoint', async () => {
    const coach = await newCoach();
    const food = await addFood(coach);
    const pending = await request(coach, food.id).expect(201);
    expect(
      (
        await harness
          .as(coach)
          .get('/admin/food-publication-requests')
          .expect(403)
      ).body.code,
    ).toBe('PLATFORM_ADMIN_ONLY');
    await Promise.all(
      ['approve', 'reject', 'duplicate'].map((action) =>
        harness
          .as(coach)
          .post(`/admin/food-publication-requests/${pending.body.id}/${action}`)
          .send({ note: 'No', duplicateOfFoodId: food.id })
          .expect(403),
      ),
    );
  });
});
