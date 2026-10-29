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

  type Food = {
    id: string;
    nameAr: string;
    nameEn: string | null;
    slug: string | null;
    category: string;
    kcal100g: number;
    protein100g: number;
    carb100g: number;
    fat100g: number;
    fiber100g: number;
    isActive: boolean;
    isCustom: boolean;
    source: string | null;
    units: { id: string; labelAr: string; grams: number; isDefault: boolean }[];
  };

  const list = async (session: TestSession, query = '') =>
    (await harness.as(session).get(`/foods?limit=100${query}`).expect(200))
      .body as { items: Food[]; total: number };

  const mine = {
    nameAr: 'أكلتي',
    nameEn: 'My dish',
    category: 'composite',
    kcal100g: 200,
    protein100g: 10,
    carb100g: 20,
    fat100g: 8,
    fiber100g: 2,
    units: [
      { labelAr: 'طبق', grams: 300 },
      { labelAr: 'ملعقة', grams: 30, isDefault: true },
    ],
  };

  const create = (session: TestSession, body: Record<string, unknown>) =>
    harness.as(session).post('/foods').send(body);

  describe('GET /foods', () => {
    it('lists the library with each food’s units', async () => {
      const { session } = await newCoach();

      const { items, total } = await list(session);

      expect(total).toBeGreaterThanOrEqual(63);
      const chicken = items.find((f) => f.slug === 'chicken-breast-grilled')!;
      expect(chicken).toEqual({
        id: expect.any(String),
        nameAr: 'صدر فراخ مشوي',
        nameEn: 'Grilled chicken breast',
        slug: 'chicken-breast-grilled',
        category: 'protein',
        kcal100g: 165,
        protein100g: 31,
        carb100g: 0,
        fat100g: 3.6,
        fiber100g: 0,
        isActive: true,
        isCustom: false,
        source: 'estimate_v1',
        units: [
          {
            id: expect.any(String),
            labelAr: 'قطعة متوسطة',
            grams: 120,
            isDefault: true,
          },
          {
            id: expect.any(String),
            labelAr: 'قطعة صغيرة',
            grams: 80,
            isDefault: false,
          },
        ],
      });
    });

    it('has numbers that agree with each other, and exactly one default unit, for every library food', async () => {
      const { session } = await newCoach();
      const policy = new FoodMacrosPolicy();
      const all: Food[] = [];
      for (let page = 1; ; page += 1) {
        const body = (
          await harness
            .as(session)
            .get(`/foods?limit=100&page=${page}`)
            .expect(200)
        ).body;
        all.push(...body.items);
        if (!body.hasNext) break;
      }

      const library = all.filter((f) => !f.isCustom);
      expect(library.length).toBeGreaterThanOrEqual(63);
      for (const food of library) {
        expect([food.slug, policy.check(food).outcome]).toEqual([
          food.slug,
          'valid',
        ]);
        expect([
          food.slug,
          food.units.filter((u) => u.isDefault).length,
        ]).toEqual([food.slug, 1]);
      }
    });

    it('includes the Egyptian dishes no global database has, as one food each', async () => {
      const { session } = await newCoach();

      const { items } = await list(session, '&category=composite');

      const koshari = items.find((f) => f.slug === 'koshari')!;
      expect(koshari.nameAr).toBe('كشري');
      expect(koshari.units[0]).toMatchObject({
        labelAr: 'طبق متوسط',
        grams: 450,
      });
      expect(items.every((f) => f.category === 'composite')).toBe(true);
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
      expect(english.items.map((f) => f.slug).sort()).toEqual([
        'rice-brown-cooked',
        'rice-white-cooked',
      ]);
    });

    it('takes the characters of a search literally, not as a pattern', async () => {
      const { session } = await newCoach();

      expect(
        (await list(session, `&q=${encodeURIComponent('%')}`)).items,
      ).toEqual([]);
    });

    it('refuses a category nobody uses', async () => {
      const { session } = await newCoach();

      await harness.as(session).get('/foods?category=candy').expect(400);
    });
  });

  describe('POST /foods', () => {
    it('adds a food of the coach’s own, which only they see', async () => {
      const coach = await newCoach();
      const other = await newCoach();

      const created = await create(coach.session, mine).expect(201);
      const seenByCoach = await list(coach.session, '&q=dish');
      const seenByOther = await list(other.session, '&q=dish');

      expect(created.body).toMatchObject({
        nameAr: 'أكلتي',
        nameEn: 'My dish',
        slug: null,
        isCustom: true,
        isActive: true,
        source: 'manual',
        kcal100g: 200,
      });
      expect(
        created.body.units.map((u: Food['units'][number]) => [
          u.labelAr,
          u.grams,
          u.isDefault,
        ]),
      ).toEqual([
        ['طبق', 300, false],
        ['ملعقة', 30, true],
      ]);
      expect(seenByCoach.items.map((f) => f.id)).toEqual([created.body.id]);
      expect(seenByOther.items).toEqual([]);
    });

    it('makes the first unit the default when none is marked, and needs no units at all', async () => {
      const { session } = await newCoach();

      const withUnits = await create(session, {
        ...mine,
        units: [
          { labelAr: 'كوب', grams: 240 },
          { labelAr: 'ملعقة', grams: 15 },
        ],
      }).expect(201);
      const without = await create(session, {
        ...mine,
        units: undefined,
      }).expect(201);

      expect(withUnits.body.units[0].isDefault).toBe(true);
      expect(withUnits.body.units[1].isDefault).toBe(false);
      expect(without.body.units).toEqual([]);
    });

    it('refuses numbers that contradict each other, naming what is wrong', async () => {
      const { session } = await newCoach();

      const response = await create(session, {
        ...mine,
        kcal100g: 20,
        fiber100g: 30,
      }).expect(422);

      expect(response.body.code).toBe('INVALID_FOOD');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          'kcal100g: inconsistent',
          'fiber100g: more than the carbohydrates',
        ]),
      );
    });

    it('refuses more than a hundred grams of macros in a hundred grams', async () => {
      const { session } = await newCoach();

      const response = await create(session, {
        ...mine,
        kcal100g: 500,
        protein100g: 50,
        carb100g: 50,
        fat100g: 50,
        fiber100g: 0,
      }).expect(422);

      expect(response.body.details).toContain('macros: more than 100 g');
    });

    it('refuses two default units and the same unit twice', async () => {
      const { session } = await newCoach();

      const twoDefaults = await create(session, {
        ...mine,
        units: [
          { labelAr: 'أ', grams: 1, isDefault: true },
          { labelAr: 'ب', grams: 2, isDefault: true },
        ],
      }).expect(422);
      const duplicate = await create(session, {
        ...mine,
        units: [
          { labelAr: 'كوب', grams: 1 },
          { labelAr: 'كوب', grams: 2 },
        ],
      }).expect(422);

      expect(twoDefaults.body.details).toEqual([
        'units: more than one default',
      ]);
      expect(duplicate.body.details).toEqual(['units[1]: duplicate']);
    });

    it.each([
      ['no Arabic name', { nameAr: undefined }],
      ['a blank name', { nameAr: '   ' }],
      ['a category nobody uses', { category: 'candy' }],
      ['no calories', { kcal100g: undefined }],
      ['negative protein', { protein100g: -1 }],
      ['protein over a hundred grams', { protein100g: 101 }],
      ['calories over 900', { kcal100g: 901 }],
      ['three decimals', { fat100g: 8.123 }],
      ['a unit of no weight', { units: [{ labelAr: 'كوب', grams: 0 }] }],
      ['a unit with no name', { units: [{ grams: 5 }] }],
      [
        'more than ten units',
        {
          units: Array.from({ length: 11 }, (_u, i) => ({
            labelAr: `u${i}`,
            grams: 1,
          })),
        },
      ],
    ])('refuses %s', async (_label, change) => {
      const { session } = await newCoach();

      await create(session, { ...mine, ...change }).expect(400);
    });
  });

  describe('GET and PATCH /foods/:id', () => {
    it('shows a library food and a custom one', async () => {
      const { session } = await newCoach();
      const custom = await create(session, mine).expect(201);
      const library = (await list(session, '&q=koshari')).items[0];

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
        kcal100g: 200,
      });
      expect(response.body.units).toHaveLength(2);
    });

    it('replaces the units when a list is sent', async () => {
      const { session } = await newCoach();
      const custom = await create(session, mine).expect(201);

      const response = await harness
        .as(session)
        .patch(`/foods/${custom.body.id}`)
        .send({ units: [{ labelAr: 'قطعة', grams: 50 }] })
        .expect(200);

      expect(response.body.units).toEqual([
        { id: expect.any(String), labelAr: 'قطعة', grams: 50, isDefault: true },
      ]);
    });

    it('checks the numbers as they will be after the change', async () => {
      const { session } = await newCoach();
      const custom = await create(session, mine).expect(201);

      const response = await harness
        .as(session)
        .patch(`/foods/${custom.body.id}`)
        .send({ protein100g: 90 })
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
      const hidden = await list(session, '&q=dish');
      const shown = await list(session, '&q=dish&includeInactive=true');
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
      const library = (await list(session, '&q=koshari')).items[0];

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
