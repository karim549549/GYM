import type { FoodRecord } from '../src/foods/interfaces/food.interface';
import { randomUUID } from 'node:crypto';
import { FoodMacrosPolicy } from '../src/foods/policies/food-macros.policy';
import { HttpTestApp, type TestSession } from './support/http-test-app';

jest.setTimeout(30_000);

describe('The food database over HTTP', () => {
  let harness: HttpTestApp;

  beforeAll(async () => {
    harness = await HttpTestApp.start();
  });

  afterAll(() => harness.stop(), 60_000);

  const newCoach = async () => {
    const { session } = await harness.signedUpPerson();
    const created = await harness
      .as(session)
      .post('/workspaces')
      .send({ brandName: 'Foods Gym' })
      .expect(201);
    harness.trackWorkspace(created.body.id);
    return { session, workspaceId: created.body.id as string };
  };

  type Food = FoodRecord;

  const list = async (session: TestSession, query = '') =>
    (await harness.as(session).get(`/foods?limit=100${query}`).expect(200))
      .body as { items: Food[]; total: number };

  const mine = {
    nameAr: 'أكلتي',
    nameEn: 'My dish',
    category: 'composite',
    confirmNotDuplicate: true,
    caloriesKcalPer100g: 200,
    proteinGPer100g: 10,
    carbsGPer100g: 20,
    fatGPer100g: 8,
    fiberGPer100g: 2,
    portions: [
      { nameAr: 'طبق', weightG: 300 },
      { nameAr: 'ملعقة', weightG: 30, isDefault: true },
    ],
  };

  const create = (session: TestSession, body: Record<string, unknown>) =>
    harness.as(session).post('/foods').send(body);

  describe('GET /foods', () => {
    it('finds the Egyptian tomato alias after SQL normalization', async () => {
      const { session } = await newCoach();
      const result = await list(
        session,
        `&q=${encodeURIComponent('قُوطَة')}&scope=shared`,
      );
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items.some((food) => food.nameAr.includes('طماطم'))).toBe(
        true,
      );
    });

    it('ranks exact, prefix, contains, then fuzzy aliases and enforces the selected scope', async () => {
      const { session } = await newCoach();
      const other = await newCoach();
      const term = `rank${randomUUID().split('-')[0]}`;
      const add = async (alias: string, actor = session) =>
        (
          await create(actor, {
            ...mine,
            aliases: [{ kind: 'alias_en', alias }],
          }).expect(201)
        ).body.id as string;
      const fuzzy = await add(`${term.slice(0, -1)}z`);
      const contains = await add(`before ${term} after`);
      const prefix = await add(`${term} tail`);
      const exact = await add(term);
      await add(term, other.session);
      expect(
        (await list(session, `&q=${term}&scope=mine`)).items.map(
          (food) => food.id,
        ),
      ).toEqual([exact, prefix, contains, fuzzy]);
      expect((await list(session, `&q=${term}&scope=shared`)).items).toEqual(
        [],
      );
      await harness.as(session).get('/foods?scope=wrong').expect(400);
      await harness.as(session).get('/foods?state=burnt').expect(400);
    });
    it('lists the current shared seed with richer food fields and a default portion', async () => {
      const { session } = await newCoach();
      const { items, total } = await list(session);
      expect(total).toBeGreaterThanOrEqual(437);
      expect(items.find((food) => food.origin === 'seed')).toMatchObject({
        isOwn: false,
        origin: 'seed',
        isVerified: false,
        aliases: expect.any(Object),
        nutrients: expect.any(Array),
        reviewFlags: expect.any(Array),
        defaultPortion: expect.objectContaining({ isDefault: true }),
      });
    });

    it('has numbers that agree with each other, and exactly one default portion, for every library food', async () => {
      const { session } = await newCoach();
      const policy = new FoodMacrosPolicy();
      const all: Food[] = [];
      const readPage = async (page = 1): Promise<void> => {
        const body = (
          await harness
            .as(session)
            .get(`/foods?limit=100&page=${page}`)
            .expect(200)
        ).body;
        all.push(...body.items);
        if (body.hasNext) {
          await readPage(page + 1);
        }
      };
      await readPage();

      const library = all.filter((f) => !f.isCustom);
      expect(library.length).toBeGreaterThanOrEqual(63);
      for (const food of library) {
        expect([food.slug, policy.check(food).outcome]).toEqual([
          food.slug,
          'valid',
        ]);
        expect([
          food.slug,
          food.portions.filter((u) => u.isDefault).length,
        ]).toEqual([food.slug, 1]);
      }
    });

    it('is paged, by Arabic name', async () => {
      const { session } = await newCoach();

      const response = await harness
        .as(session)
        .get('/foods?limit=5&page=2')
        .expect(200);

      expect(response.body).toMatchObject({
        page: 2,
        limit: 5,
        hasPrev: true,
        hasNext: true,
      });
    });

    it('searches the Arabic and the English name', async () => {
      const { session } = await newCoach();

      const arabic = await list(session, `&q=${encodeURIComponent('فراخ')}`);
      const english = await list(session, '&q=rice');

      expect(arabic.items.map((f) => f.slug)).toEqual(
        expect.arrayContaining(['chicken-breast-grilled']),
      );
      expect(english.items.map((f) => f.slug)).toEqual(
        expect.arrayContaining(['rice-brown-cooked', 'rice-white-cooked']),
      );
    });

    it('takes the characters of a search literally, not as a pattern', async () => {
      const { session } = await newCoach();

      const { items } = await list(session, `&q=${encodeURIComponent('%')}`);

      // a pattern would match every food; taken literally only names containing a percent sign do
      items.forEach((item: { nameAr: string; nameEn: string | null }) =>
        expect(`${item.nameAr} ${item.nameEn ?? ''}`).toContain('%'),
      );
    });

    it('refuses a category nobody uses', async () => {
      const { session } = await newCoach();

      await harness.as(session).get('/foods?category=candy').expect(400);
    });
  });

  describe('POST /foods', () => {
    it('round trips a per 100 g label with known nutrients, aliases and origin fields', async () => {
      const { session } = await newCoach();
      const result = await create(session, {
        ...mine,
        brand: 'My brand',
        state: 'ready_to_eat',
        origin: 'package_label',
        description: 'Package label',
        entry: { basis: 'per_100g' },
        nutrients: [
          { code: 'sodium', amount: 0 },
          { code: 'sugars', amount: 4 },
        ],
        aliases: [{ kind: 'alias_ar', alias: 'اسم بديل' }],
      }).expect(201);
      expect(result.body).toMatchObject({
        brand: 'My brand',
        state: 'ready_to_eat',
        origin: 'package_label',
        description: 'Package label',
        entryBasis: 'per_100g',
        enteredServingWeightG: null,
        isOwn: true,
        aliases: { alias_ar: ['اسم بديل'] },
      });
      expect(result.body.nutrients).toHaveLength(2);
      expect(result.body.nutrients).toContainEqual(
        expect.objectContaining({
          code: 'sodium',
          amountPer100g: 0,
          measureUnit: 'mg',
          nameAr: expect.any(String),
          nameEn: expect.any(String),
        }),
      );
      const detail = await harness
        .as(session)
        .get(`/foods/${result.body.id}`)
        .expect(200);
      expect(detail.body).toEqual(result.body);
      expect(
        (await list(session, `&q=${encodeURIComponent('اسم بديل')}`)).items.map(
          (food) => food.id,
        ),
      ).toContain(result.body.id);
    });

    it('converts serving values, rounds nutrients and supplies a default serving portion', async () => {
      const { session } = await newCoach();
      const entry = {
        ...mine,
        entry: { basis: 'per_serving', servingWeightG: 30 },
        caloriesKcalPer100g: 60,
        proteinGPer100g: 3,
        carbsGPer100g: 6,
        fatGPer100g: 2.4,
        fiberGPer100g: 0.6,
        portions: undefined,
        nutrients: [{ code: 'iron', amount: 1 }],
      };
      const result = await create(session, entry).expect(201);
      expect(result.body).toMatchObject({
        caloriesKcalPer100g: 200,
        proteinGPer100g: 10,
        carbsGPer100g: 20,
        fatGPer100g: 8,
        fiberGPer100g: 2,
        entryBasis: 'per_serving',
        enteredServingWeightG: 30,
        defaultPortion: { nameAr: 'حصة', weightG: 30 },
      });
      expect(result.body.nutrients[0].amountPer100g).toBe(3.33);
      const supplied = await create(session, {
        ...entry,
        portions: [{ nameAr: 'علبة', weightG: 60 }],
      }).expect(201);
      expect(supplied.body.portions).toHaveLength(1);
      expect(supplied.body.defaultPortion.nameAr).toBe('علبة');
      const bad = await create(session, {
        ...entry,
        entry: { basis: 'per_serving' },
      }).expect(422);
      expect(bad.body.code).toBe('INVALID_FOOD');
      await create(session, {
        ...entry,
        entry: { basis: 'per_serving', servingWeightG: 5001 },
      }).expect(400);
    });

    it.each(['4006381333932', '123456789', 'bad-code'])(
      'refuses invalid GS1 barcode %s',
      async (barcode) => {
        const { session } = await newCoach();
        expect(
          (await create(session, { ...mine, barcode }).expect(422)).body.code,
        ).toBe('INVALID_BARCODE');
      },
    );

    it('returns barcode summaries and name candidates, and permits only the name override', async () => {
      const { session } = await newCoach();
      const first = await create(session, {
        ...mine,
        barcode: '036000291452',
      }).expect(201);
      const barcode = await create(session, {
        ...mine,
        barcode: '036000291452',
      }).expect(409);
      expect(barcode.body).toMatchObject({
        code: 'FOOD_BARCODE_EXISTS',
        details: { id: first.body.id },
      });
      const name = await create(session, {
        ...mine,
        confirmNotDuplicate: false,
      }).expect(409);
      expect(name.body.code).toBe('FOOD_POSSIBLE_DUPLICATE');
      expect(name.body.details.length).toBeLessThanOrEqual(5);
      expect(name.body.details).toContainEqual(
        expect.objectContaining({ id: first.body.id }),
      );
      await create(session, mine).expect(201);
      const other = await newCoach();
      await create(other.session, {
        ...mine,
        barcode: '036000291452',
        confirmNotDuplicate: false,
      }).expect(201);
      const shared = (await list(session, '&scope=shared')).items[0];
      const duplicate = await create(session, {
        ...mine,
        nameAr: shared.nameAr,
        nameEn: shared.nameEn,
        confirmNotDuplicate: false,
      }).expect(409);
      expect(duplicate.body.details).toContainEqual(
        expect.objectContaining({ id: shared.id }),
      );
    });
    it('adds a food of the coach’s own, which only they see', async () => {
      const coach = await newCoach();
      const other = await newCoach();

      const created = await create(coach.session, mine).expect(201);
      const seenByCoach = await list(coach.session, '&q=dish&scope=mine');
      const seenByOther = await list(other.session, '&q=dish&scope=mine');

      expect(created.body).toMatchObject({
        nameAr: 'أكلتي',
        nameEn: 'My dish',
        slug: null,
        isCustom: true,
        isActive: true,
        originNote: 'manual',
        caloriesKcalPer100g: 200,
      });
      expect(
        created.body.portions.map((u: Food['portions'][number]) => [
          u.nameAr,
          u.weightG,
          u.isDefault,
        ]),
      ).toEqual([
        ['طبق', 300, false],
        ['ملعقة', 30, true],
      ]);
      expect(seenByCoach.items.map((f) => f.id)).toEqual([created.body.id]);
      expect(seenByOther.items).toEqual([]);
    });

    it('makes the first portion the default when none is marked, and needs no portions at all', async () => {
      const { session } = await newCoach();

      const withPortions = await create(session, {
        ...mine,
        portions: [
          { nameAr: 'كوب', weightG: 240 },
          { nameAr: 'ملعقة', weightG: 15 },
        ],
      }).expect(201);
      const without = await create(session, {
        ...mine,
        portions: undefined,
      }).expect(201);

      expect(withPortions.body.portions[0].isDefault).toBe(true);
      expect(withPortions.body.portions[1].isDefault).toBe(false);
      expect(without.body.portions).toEqual([]);
    });

    it('refuses numbers that contradict each other, naming what is wrong', async () => {
      const { session } = await newCoach();

      const response = await create(session, {
        ...mine,
        caloriesKcalPer100g: 20,
        fiberGPer100g: 30,
      }).expect(422);

      expect(response.body.code).toBe('INVALID_FOOD');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          'caloriesKcalPer100g: inconsistent',
          'fiberGPer100g: more than the carbohydrates',
        ]),
      );
    });

    it('refuses more than a hundred weightG of macros in a hundred weightG', async () => {
      const { session } = await newCoach();

      const response = await create(session, {
        ...mine,
        caloriesKcalPer100g: 500,
        proteinGPer100g: 50,
        carbsGPer100g: 50,
        fatGPer100g: 50,
        fiberGPer100g: 0,
      }).expect(422);

      expect(response.body.details).toContain('macros: more than 100 g');
    });

    it('refuses two default portions and the same portion twice', async () => {
      const { session } = await newCoach();

      const twoDefaults = await create(session, {
        ...mine,
        portions: [
          { nameAr: 'أ', weightG: 1, isDefault: true },
          { nameAr: 'ب', weightG: 2, isDefault: true },
        ],
      }).expect(422);
      const duplicate = await create(session, {
        ...mine,
        portions: [
          { nameAr: 'كوب', weightG: 1 },
          { nameAr: 'كوب', weightG: 2 },
        ],
      }).expect(422);

      expect(twoDefaults.body.details).toEqual([
        'portions: more than one default',
      ]);
      expect(duplicate.body.details).toEqual(['portions[1]: duplicate']);
    });

    it.each([
      ['no Arabic name', { nameAr: undefined }],
      ['a blank name', { nameAr: '   ' }],
      ['a category nobody uses', { category: 'candy' }],
      ['no calories', { caloriesKcalPer100g: undefined }],
      ['negative protein', { proteinGPer100g: -1 }],

      ['three decimals', { fatGPer100g: 8.123 }],
      ['a portion of no weight', { portions: [{ nameAr: 'كوب', weightG: 0 }] }],
      ['a portion with no name', { portions: [{ weightG: 5 }] }],
      [
        'more than ten portions',
        {
          portions: Array.from({ length: 11 }, (_u, i) => ({
            nameAr: `u${i}`,
            weightG: 1,
          })),
        },
      ],
    ])('refuses %s', async (_label, change) => {
      const { session } = await newCoach();

      await create(session, { ...mine, ...change }).expect(400);
    });
  });

  describe('GET and PATCH /foods/:id', () => {
    it('converts a serving patch once and replaces nutrients and aliases', async () => {
      const { session } = await newCoach();
      const created = await create(session, mine).expect(201);
      const result = await harness
        .as(session)
        .patch(`/foods/${created.body.id}`)
        .send({
          entry: { basis: 'per_serving', servingWeightG: 50 },
          caloriesKcalPer100g: 100,
          proteinGPer100g: 5,
          carbsGPer100g: 10,
          fatGPer100g: 4,
          fiberGPer100g: 1,
          nutrients: [{ code: 'sodium', amount: 5 }],
          aliases: [{ kind: 'alias_en', alias: 'updated alias' }],
        })
        .expect(200);
      expect(result.body.caloriesKcalPer100g).toBe(200);
      expect(result.body.nutrients[0].amountPer100g).toBe(10);
      expect(
        (
          await harness
            .as(session)
            .patch(`/foods/${created.body.id}`)
            .send({})
            .expect(200)
        ).body,
      ).toEqual(result.body);
      const cleared = await harness
        .as(session)
        .patch(`/foods/${created.body.id}`)
        .send({
          nutrients: [],
          aliases: [],
          portions: [],
          barcode: null,
          brand: null,
          confirmNotDuplicate: true,
        })
        .expect(200);
      expect(cleared.body).toMatchObject({
        nutrients: [],
        portions: [],
        aliases: { alias_ar: [], alias_en: [], search_hint: [] },
      });
      const partial = await harness
        .as(session)
        .patch(`/foods/${created.body.id}`)
        .send({
          entry: { basis: 'per_serving', servingWeightG: 50 },
          proteinGPer100g: 1,
        })
        .expect(422);
      expect(partial.body.code).toBe('INVALID_FOOD');
    });
    it('shows a library food and a custom one', async () => {
      const { session } = await newCoach();
      const custom = await create(session, mine).expect(201);
      const library = (await list(session, '&q=chicken')).items[0];

      const one = await harness
        .as(session)
        .get(`/foods/${custom.body.id}`)
        .expect(200);
      const global = await harness
        .as(session)
        .get(`/foods/${library.id}`)
        .expect(200);

      expect(one.body).toEqual(custom.body);
      expect(global.body).toEqual(library);
    });

    it('is not found for an id that is not there, and refuses one that is not an id', async () => {
      const { session } = await newCoach();

      const missing = await harness
        .as(session)
        .get(`/foods/${randomUUID()}`)
        .expect(404);
      await harness.as(session).get('/foods/nope').expect(400);

      expect(missing.body.code).toBe('FOOD_NOT_FOUND');
    });

    it('changes what was sent and leaves the rest, and null clears the English name', async () => {
      const { session } = await newCoach();
      const custom = await create(session, mine).expect(201);

      const response = await harness
        .as(session)
        .patch(`/foods/${custom.body.id}`)
        .send({ nameAr: 'اسم جديد', nameEn: null })
        .expect(200);

      expect(response.body).toMatchObject({
        nameAr: 'اسم جديد',
        nameEn: null,
        caloriesKcalPer100g: 200,
      });
      expect(response.body.portions).toHaveLength(2);
    });

    it('replaces the portions when a list is sent', async () => {
      const { session } = await newCoach();
      const custom = await create(session, mine).expect(201);

      const response = await harness
        .as(session)
        .patch(`/foods/${custom.body.id}`)
        .send({ portions: [{ nameAr: 'قطعة', weightG: 50 }] })
        .expect(200);

      expect(response.body.portions).toEqual([
        {
          id: expect.any(String),
          nameAr: 'قطعة',
          weightG: 50,
          isDefault: true,
        },
      ]);
    });

    it('checks the numbers as they will be after the change', async () => {
      const { session } = await newCoach();
      const custom = await create(session, mine).expect(201);

      const response = await harness
        .as(session)
        .patch(`/foods/${custom.body.id}`)
        .send({ proteinGPer100g: 90 })
        .expect(422);

      expect(response.body.code).toBe('INVALID_FOOD');
    });

    it('is never deleted, only deactivated: it leaves the list but can still be read', async () => {
      const { session } = await newCoach();
      const custom = await create(session, mine).expect(201);

      await harness
        .as(session)
        .patch(`/foods/${custom.body.id}`)
        .send({ isActive: false })
        .expect(200);
      const hidden = await list(session, '&q=dish&scope=mine');
      const shown = await list(
        session,
        '&q=dish&includeInactive=true&scope=mine',
      );
      const read = await harness
        .as(session)
        .get(`/foods/${custom.body.id}`)
        .expect(200);

      expect(hidden.items).toEqual([]);
      expect(shown.items.map((f) => f.id)).toEqual([custom.body.id]);
      expect(read.body.isActive).toBe(false);
    });

    it('does not let a library food be changed', async () => {
      const { session } = await newCoach();
      const library = (await list(session, '&q=chicken')).items[0];

      const response = await harness
        .as(session)
        .patch(`/foods/${library.id}`)
        .send({ nameAr: 'مخترق' })
        .expect(403);

      expect(response.body.code).toBe('FOOD_NOT_EDITABLE');
    });

    it('does not reach another coach’s food', async () => {
      const coach = await newCoach();
      const other = await newCoach();
      const custom = await create(coach.session, mine).expect(201);

      await harness
        .as(other.session)
        .get(`/foods/${custom.body.id}`)
        .expect(404);
      await harness
        .as(other.session)
        .patch(`/foods/${custom.body.id}`)
        .send({ nameAr: 'مسروق' })
        .expect(404);
    });
  });
});
