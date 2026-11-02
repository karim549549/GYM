import { randomUUID } from 'node:crypto';
import { HttpTestApp, type TestSession } from './support/http-test-app';
import type { RecipeRecord } from '../src/recipes/interfaces/recipe.interface';
import type { FoodRecord } from '../src/foods/interfaces/food.interface';
jest.setTimeout(60_000);
describe('Recipes over HTTP', () => {
  let harness: HttpTestApp;
  let session: TestSession;
  let other: TestSession;
  let foods: FoodRecord[];
  let shared: RecipeRecord;
  beforeAll(async () => {
    harness = await HttpTestApp.start();
    session = await coach();
    other = await coach();
    foods = await Promise.all(
      Array.from({ length: 3 }, async (_, n) => {
        const response = await harness
          .as(session)
          .post('/foods')
          .send({
            nameAr: `Recipe ingredient ${n}`,
            confirmNotDuplicate: true,
            category: 'protein',
            caloriesKcalPer100g: 150,
            proteinGPer100g: 10,
            carbsGPer100g: 20,
            fatGPer100g: 3,
            fiberGPer100g: 2,
          })
          .expect(201);
        return response.body as FoodRecord;
      }),
    );
    const response = await harness
      .as(session)
      .get('/recipes?scope=shared&limit=1')
      .expect(200);
    shared = response.body.items[0] as RecipeRecord;
  });
  afterAll(() => harness.stop(), 60_000);
  const coach = async () => {
    const { session } = await harness.signedUpPerson();
    const response = await harness
      .as(session)
      .post('/workspaces')
      .send({ brandName: 'Recipes Gym' })
      .expect(201);
    harness.trackWorkspace(response.body.id);
    return session;
  };
  const input = () => ({
    nameAr: 'Test recipe',
    nameEn: 'Test dish',
    descriptionAr: 'A dish',
    finishedWeightG: 300,
    prepMinutes: 10,
    cookMinutes: 20,
    mealTags: ['lunch'],
    ingredients: foods.map((f) => ({ foodId: f.id, weightG: 100 })),
    steps: [{ instruction: 'Mix ingredients' }],
    portions: [{ nameAr: 'plate', weightG: 150, isDefault: true }],
    aliases: [{ kind: 'alias_en', alias: 'uniquerecipealias' }],
  });
  const create = async () =>
    (await harness.as(session).post('/recipes').send(input()).expect(201))
      .body as RecipeRecord;
  it('creates calculated nutrition, returns ingredients and per-portion values', async () => {
    const created = await create();
    expect(created).toMatchObject({
      caloriesKcalPer100g: 150,
      proteinGPer100g: 10,
      carbsGPer100g: 20,
      fatGPer100g: 3,
      fiberGPer100g: 2,
      origin: 'user',
      isOwn: true,
      slug: null,
    });
    const detail = (
      await harness.as(session).get(`/recipes/${created.id}`).expect(200)
    ).body as RecipeRecord;
    expect(detail.portions[0]).toMatchObject({
      caloriesKcal: 225,
      proteinG: 15,
      carbsG: 30,
      fatG: 4.5,
      fiberG: 3,
    });
    expect(detail.ingredients[0].food).toMatchObject({
      id: foods[0].id,
      nameAr: foods[0].nameAr,
      category: 'protein',
    });
    expect(detail.steps[0]).toMatchObject({
      instruction: 'Mix ingredients',
      sortOrder: 1,
    });
  });
  it('searches names and aliases with scope, meal tag and pagination', async () => {
    const created = await create();
    await Promise.all(
      ['Test recipe', 'uniquerecipealias'].map(async (q) => {
        const response = await harness
          .as(session)
          .get(
            `/recipes?q=${encodeURIComponent(q)}&scope=mine&mealTag=lunch&limit=1`,
          )
          .expect(200);
        expect(response.body.items.length).toBe(1);
        expect(response.body.total).toBeGreaterThan(0);
        expect(response.body.page).toBe(1);
        expect(response.body.items[0]).toMatchObject({
          isOwn: true,
          ingredientCount: 3,
        });
      }),
    );
    const sharedOnly = await harness
      .as(session)
      .get('/recipes?scope=shared&limit=100')
      .expect(200);
    expect(
      sharedOnly.body.items.some((r: RecipeRecord) => r.id === created.id),
    ).toBe(false);
    const wrongTag = await harness
      .as(session)
      .get('/recipes?q=uniquerecipealias&mealTag=breakfast&scope=mine')
      .expect(200);
    expect(wrongTag.body.items).toEqual([]);
  });
  it('ranks exact, prefix, contains and fuzzy aliases in that order', async () => {
    const candidates = await Promise.all(
      ['ranktoken', 'ranktoken extra', 'xx ranktoken yy', 'ranktoke'].map(
        (alias) =>
          harness
            .as(session)
            .post('/recipes')
            .send({
              ...input(),
              nameAr: 'Ranking candidate',
              aliases: [{ kind: 'search_hint', alias }],
            })
            .expect(201),
      ),
    );
    const result = await harness
      .as(session)
      .get('/recipes?scope=mine&q=RANKTOKEN&limit=100')
      .expect(200);
    expect(result.body.items.map((r: RecipeRecord) => r.id)).toEqual(
      candidates.map((response) => response.body.id as string),
    );
  });

  it('recomputes yield and ingredient edits and replaces children', async () => {
    const created = await create();
    const patched = await harness
      .as(session)
      .patch(`/recipes/${created.id}`)
      .send({
        finishedWeightG: 600,
        steps: [],
        aliases: [],
        portions: [{ nameAr: 'slice', weightG: 100, isDefault: true }],
      })
      .expect(200);
    expect(patched.body.caloriesKcalPer100g).toBe(75);
    expect(patched.body.steps).toEqual([]);
    expect(patched.body.aliases).toEqual([]);
    const ingredients = foods.map((f) => ({ foodId: f.id, weightG: 200 }));
    const again = await harness
      .as(session)
      .patch(`/recipes/${created.id}`)
      .send({ ingredients })
      .expect(200);
    expect(again.body.caloriesKcalPer100g).toBe(150);
    await harness
      .as(session)
      .patch(`/recipes/${created.id}`)
      .send({ isActive: false })
      .expect(200);
    const active = await harness
      .as(session)
      .get('/recipes?scope=mine&limit=100')
      .expect(200);
    expect(
      active.body.items.some((r: RecipeRecord) => r.id === created.id),
    ).toBe(false);
    const inactive = await harness
      .as(session)
      .get('/recipes?scope=mine&includeInactive=true&limit=100')
      .expect(200);
    expect(
      inactive.body.items.some((r: RecipeRecord) => r.id === created.id),
    ).toBe(true);
  });
  it('refuses shared edits and copies all recipe children', async () => {
    await harness
      .as(session)
      .patch(`/recipes/${shared.id}`)
      .send({ nameAr: 'No' })
      .expect(403)
      .expect((r) => expect(r.body.code).toBe('RECIPE_NOT_EDITABLE'));
    const original = (
      await harness.as(session).get(`/recipes/${shared.id}`).expect(200)
    ).body as RecipeRecord;
    const copy = (
      await harness
        .as(session)
        .post(`/recipes/${shared.id}/copy`)
        .send({ nameAr: 'My copy' })
        .expect(201)
    ).body as RecipeRecord;
    expect(copy).toMatchObject({
      nameAr: 'My copy',
      copiedFromRecipeId: shared.id,
      isOwn: true,
      origin: 'user',
      slug: null,
    });
    expect(copy.ingredients).toHaveLength(original.ingredients.length);
    expect(copy.steps).toEqual(original.steps);
    expect(copy.aliases).toEqual(expect.arrayContaining(original.aliases));
    expect(copy.portions).toHaveLength(original.portions.length);
    const alias = original.aliases[0]?.alias;
    if (alias) {
      const matches = await harness
        .as(session)
        .get(`/recipes?q=${encodeURIComponent(alias)}&limit=100`)
        .expect(200);
      const ids = matches.body.items.map((r: RecipeRecord) => r.id) as string[];
      expect(ids.indexOf(original.id)).toBeGreaterThanOrEqual(0);
      expect(ids.indexOf(copy.id)).toBeGreaterThan(ids.indexOf(original.id));
    }

    const own = await create();
    await harness
      .as(session)
      .post(`/recipes/${own.id}/copy`)
      .send({})
      .expect(201)
      .expect((r) => expect(r.body.copiedFromRecipeId).toBe(own.id));
  });
  it('refuses invalid yield, repeated foods, missing default, inactive and hidden foods', async () => {
    await Promise.all(
      [
        { finishedWeightG: 10 },
        {
          ingredients: foods.map(() => ({ foodId: foods[0].id, weightG: 100 })),
        },
        { portions: [{ nameAr: 'plate', weightG: 100, isDefault: false }] },
        {
          ingredients: foods.map((f) => ({
            foodId: f.id === foods[0].id ? randomUUID() : f.id,
            weightG: 100,
          })),
        },
      ].map(async (change) => {
        await harness
          .as(session)
          .post('/recipes')
          .send({ ...input(), ...change })
          .expect(422)
          .expect((r) => {
            expect(r.body.code).toBe('INVALID_RECIPE');
            expect(r.body.details.length).toBeGreaterThan(0);
          });
      }),
    );
    await harness.as(other).post('/recipes').send(input()).expect(422);
    const f = (
      await harness
        .as(session)
        .post('/foods')
        .send({
          nameAr: 'Inactive ingredient',
          category: 'protein',
          caloriesKcalPer100g: 150,
          proteinGPer100g: 10,
          carbsGPer100g: 20,
          fatGPer100g: 3,
          fiberGPer100g: 2,
        })
        .expect(201)
    ).body as FoodRecord;
    await harness
      .as(session)
      .patch(`/foods/${f.id}`)
      .send({ isActive: false })
      .expect(200);
    await harness
      .as(session)
      .post('/recipes')
      .send({
        ...input(),
        ingredients: [
          { foodId: f.id, weightG: 100 },
          ...input().ingredients.slice(1),
        ],
      })
      .expect(422);
  });
  it('rejects malformed boundaries and user-supplied nutrition', async () => {
    await Promise.all(
      [
        { ingredients: [] },
        { youtubeVideoId: 'invalid!' },
        { portions: [] },
        { caloriesKcalPer100g: 100 },
      ].map((change) =>
        harness
          .as(session)
          .post('/recipes')
          .send({ ...input(), ...change })
          .expect(400),
      ),
    );
  });
  it('isolates both recipe reads and writes across workspaces', async () => {
    const own = await create();
    await harness.as(other).get(`/recipes/${own.id}`).expect(404);
    await harness
      .as(other)
      .patch(`/recipes/${own.id}`)
      .send({ nameAr: 'No' })
      .expect(404);
    await harness
      .as(other)
      .post(`/recipes/${own.id}/copy`)
      .send({})
      .expect(404);
    const list = await harness
      .as(other)
      .get('/recipes?scope=mine&limit=100')
      .expect(200);
    expect(list.body.items.some((r: RecipeRecord) => r.id === own.id)).toBe(
      false,
    );
  });
  it('refuses assistants on every recipe route', async () => {
    const assistant = await harness.signedUpPerson();
    const invite = await harness
      .as(session)
      .post('/invitations')
      .send({ phone: assistant.body.phone })
      .expect(201);
    await harness
      .as(assistant.session)
      .post(`/invitations/${invite.body.id}/accept`)
      .expect(200);
    await Promise.all(
      ['/recipes', `/recipes/${shared.id}`].map((path) =>
        harness.as(assistant.session).get(path).expect(403),
      ),
    );
    await harness
      .as(assistant.session)
      .post('/recipes')
      .send(input())
      .expect(403);
    await harness
      .as(assistant.session)
      .patch(`/recipes/${shared.id}`)
      .send({})
      .expect(403);
    await harness
      .as(assistant.session)
      .post(`/recipes/${shared.id}/copy`)
      .send({})
      .expect(403);
  });
});
