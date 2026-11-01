import { randomUUID } from 'node:crypto';
import { HttpTestApp, type TestSession } from './support/http-test-app';

jest.setTimeout(60_000);

describe('Meal plans over HTTP', () => {
  let harness: HttpTestApp;
  let food: Record<
    string,
    {
      id: string;
      nameAr: string;
      caloriesKcalPer100g: number;
      proteinGPer100g: number;
      carbsGPer100g: number;
      fatGPer100g: number;
      portions: { id: string; nameAr: string; weightG: number }[];
    }
  >;

  beforeAll(async () => {
    harness = await HttpTestApp.start();
    const { session } = await newCoach();
    // the library has several hundred foods, so read every page, not just the first
    type Loaded = { slug: string } & (typeof food)[string];
    const readPage = async (page: number) =>
      (
        await harness
          .as(session)
          .get(`/foods?limit=100&page=${page}`)
          .expect(200)
      ).body as { items: Loaded[]; totalPages: number };
    const first = await readPage(1);
    const rest = await Promise.all(
      Array.from({ length: first.totalPages - 1 }, (_, n) => readPage(n + 2)),
    );
    const loaded = [first, ...rest].flatMap((page) => page.items);
    food = Object.fromEntries(loaded.map((f) => [f.slug, f]));
  });

  afterAll(() => harness.stop(), 60_000);

  const newCoach = async () => {
    const { session } = await harness.signedUpPerson();
    const created = await harness
      .as(session)
      .post('/workspaces')
      .send({ brandName: 'Meals Gym' })
      .expect(201);
    harness.trackWorkspace(created.body.id);
    return { session, workspaceId: created.body.id as string };
  };

  const addClient = async (session: TestSession) =>
    (
      await harness
        .as(session)
        .post('/clients')
        .send({ fullName: 'Omar Khaled', phone: harness.uniquePhone() })
        .expect(201)
    ).body as { id: string };

  const ready = async () => {
    const coach = await newCoach();
    const client = await addClient(coach.session);
    return { ...coach, client };
  };

  type Substitute = {
    sortOrder: number;
    foodId: string;
    itemName: string;
    quantity: number;
    portionId: string | null;
    portionNameAr: string | null;
    weightG: number;
    caloriesKcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
  type Plan = {
    id: string;
    clientId: string | null;
    isTemplate: boolean;
    name: string;
    caloriesKcalTarget: number | null;
    proteinGTarget: number | null;
    carbsGTarget: number | null;
    fatGTarget: number | null;
    status: string;
    startsOn: string | null;
    notes: string | null;
    meals: {
      weekday: number | null;
      sortOrder: number;
      name: string;
      suggestedTime: string | null;
      notes: string | null;
      totals: {
        caloriesKcal: number;
        proteinG: number;
        carbsG: number;
        fatG: number;
      };
      items: (Substitute & { substitutes: Substitute[] })[];
    }[];
    days: {
      weekday: number | null;
      caloriesKcal: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
      split: { proteinPct: number; carbPct: number; fatPct: number };
      gap: Record<string, number | null>;
    }[];
  };

  const make = (session: TestSession, body: Record<string, unknown>) =>
    harness.as(session).post('/meal-plans').send(body);

  const clientPlan = async (
    session: TestSession,
    clientId: string,
    body: Record<string, unknown> = {},
  ) =>
    (await make(session, { name: 'Plan', clientId, ...body }).expect(201))
      .body as Plan;

  const saveMeals = (session: TestSession, planId: string, meals: unknown[]) =>
    harness.as(session).put(`/meal-plans/${planId}/meals`).send({ meals });

  const defaultPortion = (slug: string) => food[slug].portions[0];

  const round2 = (n: number) => Math.round(n * 100) / 100;
  /** What the server copies onto an item: the food's per 100 g values worked out for the grams. */
  const macrosOf = (slug: string, grams: number) => ({
    caloriesKcal: round2((food[slug].caloriesKcalPer100g * grams) / 100),
    proteinG: round2((food[slug].proteinGPer100g * grams) / 100),
    carbsG: round2((food[slug].carbsGPer100g * grams) / 100),
    fatG: round2((food[slug].fatGPer100g * grams) / 100),
  });
  const addMacros = (
    a: ReturnType<typeof macrosOf>,
    b: ReturnType<typeof macrosOf>,
  ) => ({
    caloriesKcal: round2(a.caloriesKcal + b.caloriesKcal),
    proteinG: round2(a.proteinG + b.proteinG),
    carbsG: round2(a.carbsG + b.carbsG),
    fatG: round2(a.fatG + b.fatG),
  });
  /** The standard lunch: two portions of grilled chicken and 200 g of rice (the tuna is only a substitute). */
  const chickenWeight = () =>
    2 * defaultPortion('chicken-breast-grilled').weightG;
  const lunchTotals = () =>
    addMacros(
      macrosOf('chicken-breast-grilled', chickenWeight()),
      macrosOf('rice-white-cooked', 200),
    );

  const lunch = (overrides: Record<string, unknown> = {}) => ({
    weekday: null,
    name: 'Lunch',
    suggestedTime: '14:00',
    items: [
      {
        foodId: food['chicken-breast-grilled'].id,
        quantity: 2,
        portionId: defaultPortion('chicken-breast-grilled').id,
        substitutes: [
          {
            foodId: food['tuna-canned-water'].id,
            quantity: 1,
            portionId: defaultPortion('tuna-canned-water').id,
          },
        ],
      },
      { foodId: food['rice-white-cooked'].id, quantity: 200 },
    ],
    ...overrides,
  });

  const templatesOf = async (session: TestSession) =>
    (
      await harness
        .as(session)
        .get('/meal-plans?template=true&limit=100')
        .expect(200)
    ).body.items as { id: string; name: string }[];

  describe('the templates a new coach starts with', () => {
    it('are a cutting and a bulking plan, named in Arabic', async () => {
      const { session } = await newCoach();

      const templates = await templatesOf(session);

      expect(
        templates
          .map((t) => t.name)
          .sort((a, b) => String(a).localeCompare(String(b))),
      ).toEqual(
        ['تنشيف - حوالي 1500 سعر', 'تضخيم - حوالي 2800 سعر'].sort((a, b) =>
          String(a).localeCompare(String(b)),
        ),
      );
    });

    it('hold four meals of Egyptian foods with every number worked out, close to their targets', async () => {
      const { session } = await newCoach();
      const templates = await templatesOf(session);
      const cutting = templates.find((t) => t.name.startsWith('تنشيف'))!;
      const bulking = templates.find((t) => t.name.startsWith('تضخيم'))!;

      const cut = (
        await harness.as(session).get(`/meal-plans/${cutting.id}`).expect(200)
      ).body as Plan;
      const bulk = (
        await harness.as(session).get(`/meal-plans/${bulking.id}`).expect(200)
      ).body as Plan;

      for (const plan of [cut, bulk]) {
        expect(plan.isTemplate).toBe(true);
        expect(plan.meals).toHaveLength(4);
        expect(plan.days).toHaveLength(1);
        expect(plan.days[0].weekday).toBeNull();
        for (const meal of plan.meals) {
          expect(meal.suggestedTime).toMatch(/^\d{2}:\d{2}$/);
          for (const item of meal.items) {
            expect(item.caloriesKcal).toBeGreaterThan(0);
            expect(item.weightG).toBeGreaterThan(0);
            expect(item.portionNameAr).not.toBeNull();
          }
        }
      }
      expect(cut.days[0].caloriesKcal).toBeGreaterThan(1200);
      expect(cut.days[0].caloriesKcal).toBeLessThan(1800);
      expect(bulk.days[0].caloriesKcal).toBeGreaterThan(2400);
      expect(bulk.days[0].caloriesKcal).toBeLessThan(3300);
      expect(Math.abs(cut.days[0].gap.caloriesKcal as number)).toBeLessThan(
        400,
      );
    });

    it('are the coach’s own: another coach cannot read them', async () => {
      const mine = await newCoach();
      const other = await newCoach();
      const template = (await templatesOf(mine.session))[0];

      await harness
        .as(other.session)
        .get(`/meal-plans/${template.id}`)
        .expect(404);
    });
  });

  describe('POST /meal-plans', () => {
    it('starts a client’s plan as a draft with its targets, and no meals yet', async () => {
      const { session, client } = await ready();

      const response = await make(session, {
        name: '  Cutting  ',
        clientId: client.id,
        caloriesKcalTarget: 1800,
        proteinGTarget: 150,
        notes: 'Drink water',
      }).expect(201);

      expect(response.body).toEqual({
        id: expect.any(String),
        clientId: client.id,
        isTemplate: false,
        name: 'Cutting',
        caloriesKcalTarget: 1800,
        proteinGTarget: 150,
        carbsGTarget: null,
        fatGTarget: null,
        status: 'draft',
        startsOn: null,
        notes: 'Drink water',
        createdAt: expect.any(String),
        meals: [],
        days: [
          expect.objectContaining({
            weekday: null,
            caloriesKcal: 0,
            gap: {
              caloriesKcal: 1800,
              proteinG: 150,
              carbsG: null,
              fatG: null,
            },
          }),
        ],
      });
    });

    it('is a template when it has no client', async () => {
      const { session } = await newCoach();

      const response = await make(session, { name: 'Mine' }).expect(201);

      expect(response.body).toMatchObject({ isTemplate: true, clientId: null });
    });

    it('copies a template for a client: the same meals, numbers and targets', async () => {
      const { session, client } = await ready();
      const template = (await templatesOf(session))[0];
      const source = (
        await harness.as(session).get(`/meal-plans/${template.id}`).expect(200)
      ).body as Plan;

      const copy = (
        await make(session, {
          name: 'For Omar',
          clientId: client.id,
          fromPlanId: template.id,
        }).expect(201)
      ).body as Plan;

      expect(copy.id).not.toBe(source.id);
      expect(copy).toMatchObject({
        isTemplate: false,
        clientId: client.id,
        status: 'draft',
        caloriesKcalTarget: source.caloriesKcalTarget,
        proteinGTarget: source.proteinGTarget,
      });
      expect(copy.meals).toEqual(source.meals);
      expect(copy.days).toEqual(source.days);
    });

    it('takes the targets given over the copied ones', async () => {
      const { session, client } = await ready();
      const template = (await templatesOf(session))[0];

      const copy = await make(session, {
        name: 'x',
        clientId: client.id,
        fromPlanId: template.id,
        caloriesKcalTarget: 2000,
      }).expect(201);

      expect(copy.body.caloriesKcalTarget).toBe(2000);
    });

    it('does not reach another coach’s client or plan', async () => {
      const mine = await ready();
      const theirs = await ready();
      const theirTemplate = (await templatesOf(theirs.session))[0];

      const client = await make(mine.session, {
        name: 'x',
        clientId: theirs.client.id,
      }).expect(404);
      const source = await make(mine.session, {
        name: 'x',
        clientId: mine.client.id,
        fromPlanId: theirTemplate.id,
      }).expect(404);

      expect(client.body.code).toBe('CLIENT_NOT_FOUND');
      expect(source.body.code).toBe('MEAL_PLAN_NOT_FOUND');
    });

    it.each([
      ['no name', { name: undefined }],
      ['a blank name', { name: '   ' }],
      ['a name over 120 characters', { name: 'x'.repeat(121) }],
      ['a negative target', { caloriesKcalTarget: -1 }],
      ['a calorie target over 10000', { caloriesKcalTarget: 10_001 }],
      ['a fractional target', { proteinGTarget: 150.5 }],
      ['a client that is not an id', { clientId: 'omar' }],
    ])('refuses %s', async (_label, change) => {
      const { session } = await ready();

      await make(session, { name: 'Plan', ...change }).expect(400);
    });
  });

  describe('PUT /meal-plans/:id/meals', () => {
    it('works out every item from the food: grams, calories and macros, in portions or in grams', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id);

      const response = await saveMeals(session, plan.id, [lunch()]).expect(200);

      const meal = (response.body as Plan).meals[0];
      expect(meal).toMatchObject({
        weekday: null,
        sortOrder: 1,
        name: 'Lunch',
        suggestedTime: '14:00',
      });
      // two portions of chicken
      expect(meal.items[0]).toMatchObject({
        sortOrder: 1,
        itemName: food['chicken-breast-grilled'].nameAr,
        quantity: 2,
        portionNameAr: defaultPortion('chicken-breast-grilled').nameAr,
        weightG: chickenWeight(),
        ...macrosOf('chicken-breast-grilled', chickenWeight()),
      });
      // 200 grams of rice, no portion
      expect(meal.items[1]).toMatchObject({
        sortOrder: 2,
        itemName: food['rice-white-cooked'].nameAr,
        quantity: 200,
        portionId: null,
        portionNameAr: null,
        weightG: 200,
        ...macrosOf('rice-white-cooked', 200),
      });
    });

    it('keeps substitutes with their own numbers', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id);

      const response = await saveMeals(session, plan.id, [lunch()]).expect(200);

      const [tuna] = (response.body as Plan).meals[0].items[0].substitutes;
      expect(tuna).toMatchObject({
        sortOrder: 1,
        itemName: food['tuna-canned-water'].nameAr,
        portionNameAr: defaultPortion('tuna-canned-water').nameAr,
        weightG: defaultPortion('tuna-canned-water').weightG,
        ...macrosOf(
          'tuna-canned-water',
          defaultPortion('tuna-canned-water').weightG,
        ),
      });
    });

    it('adds up each meal and each day, and the gap to the targets', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id, {
        caloriesKcalTarget: 1000,
        proteinGTarget: 100,
      });

      const response = await saveMeals(session, plan.id, [lunch()]).expect(200);

      const body = response.body as Plan;
      expect(body.meals[0].totals).toEqual(lunchTotals());
      expect(body.days).toHaveLength(1);
      expect(body.days[0]).toMatchObject({
        weekday: null,
        caloriesKcal: lunchTotals().caloriesKcal,
        proteinG: lunchTotals().proteinG,
        gap: {
          caloriesKcal: round2(1000 - lunchTotals().caloriesKcal),
          proteinG: round2(100 - lunchTotals().proteinG),
          carbsG: null,
          fatG: null,
        },
      });
      const split = body.days[0].split;
      expect(split.proteinPct + split.carbPct + split.fatPct).toBe(100);
    });

    it('reports seven daily totals once a meal is pinned to a weekday', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id);

      const response = await saveMeals(session, plan.id, [
        lunch(),
        lunch({ weekday: 3, name: 'Tuesday extra' }),
      ]).expect(200);

      const days = (response.body as Plan).days;
      expect(days.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(days[2].caloriesKcal).toBeGreaterThan(days[0].caloriesKcal);
      expect(days[0].caloriesKcal).toBe(lunchTotals().caloriesKcal);
    });

    it('numbers meals within their day and keeps everyday meals first', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id);

      const response = await saveMeals(session, plan.id, [
        lunch({ weekday: 2, name: 'Pinned' }),
        lunch({ name: 'First' }),
        lunch({ name: 'Second' }),
      ]).expect(200);

      expect(
        (response.body as Plan).meals.map((m) => [
          m.weekday,
          m.sortOrder,
          m.name,
        ]),
      ).toEqual([
        [null, 1, 'First'],
        [null, 2, 'Second'],
        [2, 1, 'Pinned'],
      ]);
    });

    it('returns the same thing when read back, and replaces what was there', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id);
      await saveMeals(session, plan.id, [
        lunch(),
        lunch({ name: 'Dinner' }),
      ]).expect(200);

      const saved = await saveMeals(session, plan.id, [
        lunch({ name: 'Only' }),
      ]).expect(200);
      const read = await harness
        .as(session)
        .get(`/meal-plans/${plan.id}`)
        .expect(200);

      expect(read.body).toEqual(saved.body);
      expect((read.body as Plan).meals.map((m) => m.name)).toEqual(['Only']);
    });

    it('can be emptied', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id);
      await saveMeals(session, plan.id, [lunch()]).expect(200);

      const response = await saveMeals(session, plan.id, []).expect(200);

      expect(response.body.meals).toEqual([]);
    });

    it('does not rewrite a saved plan when a food is corrected later', async () => {
      const { session, client } = await ready();
      const dish = (
        await harness
          .as(session)
          .post('/foods')
          .send({
            nameAr: 'أكلتي',
            category: 'composite',
            caloriesKcalPer100g: 200,
            proteinGPer100g: 10,
            carbsGPer100g: 20,
            fatGPer100g: 8,
            fiberGPer100g: 0,
          })
          .expect(201)
      ).body as { id: string };
      const plan = await clientPlan(session, client.id);
      await saveMeals(session, plan.id, [
        lunch({ items: [{ foodId: dish.id, quantity: 100 }] }),
      ]).expect(200);

      await harness
        .as(session)
        .patch(`/foods/${dish.id}`)
        .send({
          caloriesKcalPer100g: 250,
          proteinGPer100g: 20,
          nameAr: 'اسم جديد',
        })
        .expect(200);
      const read = await harness
        .as(session)
        .get(`/meal-plans/${plan.id}`)
        .expect(200);

      expect((read.body as Plan).meals[0].items[0]).toMatchObject({
        itemName: 'أكلتي',
        caloriesKcal: 200,
        proteinG: 10,
      });
    });

    it('refuses a food or a portion that cannot be used, naming where', async () => {
      const mine = await ready();
      const theirs = await newCoach();
      const theirFood = (
        await harness
          .as(theirs.session)
          .post('/foods')
          .send({
            nameAr: 'خاص',
            category: 'protein',
            caloriesKcalPer100g: 100,
            proteinGPer100g: 20,
            carbsGPer100g: 5,
            fatGPer100g: 0,
            fiberGPer100g: 0,
          })
          .expect(201)
      ).body as { id: string };
      const plan = await clientPlan(mine.session, mine.client.id);

      const response = await saveMeals(mine.session, plan.id, [
        lunch({
          items: [
            { foodId: food['egg-boiled'].id, quantity: 1 },
            { foodId: theirFood.id, quantity: 100 },
            { foodId: randomUUID(), quantity: 100 },
            {
              foodId: food['egg-boiled'].id,
              quantity: 1,
              portionId: defaultPortion('rice-white-cooked').id,
            },
            {
              foodId: food['egg-boiled'].id,
              quantity: 1,
              substitutes: [{ foodId: randomUUID(), quantity: 1 }],
            },
          ],
        }),
      ]).expect(422);

      expect(response.body.code).toBe('FOOD_NOT_AVAILABLE');
      expect(response.body.details).toEqual([
        'meals[0].items[1].foodId: unavailable',
        'meals[0].items[2].foodId: unavailable',
        'meals[0].items[3].portionId: not a portion of this item',
        'meals[0].items[4].substitutes[0].foodId: unavailable',
      ]);
      const read = await harness
        .as(mine.session)
        .get(`/meal-plans/${plan.id}`)
        .expect(200);
      expect(read.body.meals).toEqual([]);
    });

    it('refuses a deactivated food for a plan that does not hold it yet, but a plan that holds it keeps it', async () => {
      const { session, client } = await ready();
      const dish = (
        await harness
          .as(session)
          .post('/foods')
          .send({
            nameAr: 'تجربة',
            category: 'drink',
            caloriesKcalPer100g: 40,
            proteinGPer100g: 0,
            carbsGPer100g: 10,
            fatGPer100g: 0,
            fiberGPer100g: 0,
          })
          .expect(201)
      ).body as { id: string };
      const holding = await clientPlan(session, client.id, { name: 'Holding' });
      const empty = await clientPlan(session, client.id, { name: 'Empty' });
      const use = (planId: string) =>
        saveMeals(session, planId, [
          lunch({ items: [{ foodId: dish.id, quantity: 100 }] }),
        ]);
      await use(holding.id).expect(200);
      await harness
        .as(session)
        .patch(`/foods/${dish.id}`)
        .send({ isActive: false })
        .expect(200);

      await use(holding.id).expect(200);
      const refused = await use(empty.id).expect(422);

      expect(refused.body.code).toBe('FOOD_NOT_AVAILABLE');
    });

    it('refuses a substitute that is the item itself, or offered twice', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id);
      const rice = food['rice-white-cooked'].id;
      const pasta = food['pasta-cooked'].id;

      const response = await saveMeals(session, plan.id, [
        lunch({
          items: [
            {
              foodId: rice,
              quantity: 100,
              substitutes: [
                { foodId: rice, quantity: 100 },
                { foodId: pasta, quantity: 100 },
                { foodId: pasta, quantity: 50 },
              ],
            },
          ],
        }),
      ]).expect(422);

      expect(response.body.code).toBe('INVALID_MEAL_PLAN_STRUCTURE');
      expect(response.body.details).toEqual([
        'meals[0].items[0].substitutes[0]: same as the item',
        'meals[0].items[0].substitutes[2]: duplicate',
      ]);
    });

    it('refuses more than ten meals on a day', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id);

      const response = await saveMeals(
        session,
        plan.id,
        Array.from({ length: 11 }, (_m, i) => lunch({ name: `Meal ${i}` })),
      ).expect(422);

      expect(response.body.details).toEqual([
        'meals: more than 10 on day null',
      ]);
    });

    it.each([
      ['a zero weekday', { weekday: 0 }],
      ['a missing weekday', { weekday: undefined }],
      ['a day 8', { weekday: 8 }],
      ['a negative day', { weekday: -1 }],
      ['no name', { name: undefined }],
      ['a blank name', { name: '  ' }],
      ['a time that is not a time', { suggestedTime: '25:00' }],
      ['a time with words', { suggestedTime: 'noon' }],
      ['no items list', { items: undefined }],
      ['an item with no quantity', { items: [{ foodId: 'x' }] }],
    ])('refuses %s', async (_label, change) => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id);

      await saveMeals(session, plan.id, [lunch(change)]).expect(400);
    });

    it.each([
      ['a quantity of zero', 0],
      ['a negative quantity', -5],
      ['a quantity over 10000', 10_001],
      ['three decimals', 1.234],
    ])('refuses %s', async (_label, quantity) => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id);

      await saveMeals(session, plan.id, [
        lunch({ items: [{ foodId: food['egg-boiled'].id, quantity }] }),
      ]).expect(400);
    });

    it('refuses more than five substitutes on an item', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id);
      const slugs = [
        'pasta-cooked',
        'potato-boiled',
        'bulgur-cooked',
        'oats-dry',
        'banana',
        'apple',
      ];

      await saveMeals(session, plan.id, [
        lunch({
          items: [
            {
              foodId: food['rice-white-cooked'].id,
              quantity: 100,
              substitutes: slugs.map((slug) => ({
                foodId: food[slug].id,
                quantity: 100,
              })),
            },
          ],
        }),
      ]).expect(400);
    });

    it('does not change a plan that ended', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id);
      await harness
        .as(session)
        .post(`/meal-plans/${plan.id}/activate`)
        .expect(201);
      await harness.as(session).post(`/meal-plans/${plan.id}/end`).expect(201);

      const response = await saveMeals(session, plan.id, [lunch()]).expect(409);

      expect(response.body.code).toBe('MEAL_PLAN_ENDED');
    });

    it('does not reach another coach’s plan', async () => {
      const mine = await ready();
      const theirs = await ready();
      const plan = await clientPlan(theirs.session, theirs.client.id);

      await saveMeals(mine.session, plan.id, [lunch()]).expect(404);
    });
  });

  describe('GET and PATCH /meal-plans/:id', () => {
    it('is not found for an id that is not there, and refuses one that is not an id', async () => {
      const { session } = await ready();

      const missing = await harness
        .as(session)
        .get(`/meal-plans/${randomUUID()}`)
        .expect(404);
      await harness.as(session).get('/meal-plans/nope').expect(400);

      expect(missing.body.code).toBe('MEAL_PLAN_NOT_FOUND');
    });

    it('changes the name, targets and notes, and null clears a target; the gap follows', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id, {
        caloriesKcalTarget: 2000,
        proteinGTarget: 150,
      });
      await saveMeals(session, plan.id, [lunch()]).expect(200);

      const response = await harness
        .as(session)
        .patch(`/meal-plans/${plan.id}`)
        .send({
          name: 'Renamed',
          caloriesKcalTarget: 1000,
          proteinGTarget: null,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'Renamed',
        caloriesKcalTarget: 1000,
        proteinGTarget: null,
      });
      expect(response.body.days[0].gap).toMatchObject({
        caloriesKcal: round2(1000 - lunchTotals().caloriesKcal),
        proteinG: null,
      });
    });

    it('lists plans without their meals, newest first, and filters', async () => {
      const { session, client } = await ready();
      const first = await clientPlan(session, client.id, { name: 'First' });
      const second = await clientPlan(session, client.id, { name: 'Second' });

      const mineAll = await harness
        .as(session)
        .get('/meal-plans?template=false')
        .expect(200);
      const active = await harness
        .as(session)
        .get('/meal-plans?status=active')
        .expect(200);

      expect(mineAll.body.items.map((p: Plan) => p.id)).toEqual([
        second.id,
        first.id,
      ]);
      expect(mineAll.body.items[0]).not.toHaveProperty('meals');
      expect(active.body.items).toEqual([]);
      await harness.as(session).get('/meal-plans?status=paused').expect(400);
    });
  });

  describe('activating, ending and removing', () => {
    it('starts a draft, ends the one the client was following, and leaves exactly one running', async () => {
      const { session, client } = await ready();
      const first = await clientPlan(session, client.id, { name: 'First' });
      const second = await clientPlan(session, client.id, { name: 'Second' });
      await harness
        .as(session)
        .post(`/meal-plans/${first.id}/activate`)
        .expect(201);

      const started = await harness
        .as(session)
        .post(`/meal-plans/${second.id}/activate`)
        .send({ startsOn: '2030-05-01' })
        .expect(201);
      const old = await harness
        .as(session)
        .get(`/meal-plans/${first.id}`)
        .expect(200);

      expect(started.body).toMatchObject({
        status: 'active',
        startsOn: '2030-05-01',
      });
      expect(old.body.status).toBe('ended');
    });

    it('leaves exactly one plan running when two are started at the same moment', async () => {
      const { session, client } = await ready();
      const a = await clientPlan(session, client.id, { name: 'A' });
      const b = await clientPlan(session, client.id, { name: 'B' });

      const results = await Promise.all([
        harness.as(session).post(`/meal-plans/${a.id}/activate`),
        harness.as(session).post(`/meal-plans/${b.id}/activate`),
      ]);

      const active = await harness
        .as(session)
        .get(`/meal-plans?clientId=${client.id}&status=active`)
        .expect(200);
      expect(active.body.items).toHaveLength(1);
      for (const result of results) {
        expect(
          result.status === 201 ||
            result.body.code === 'MEAL_PLAN_ACTIVATION_CONFLICT',
        ).toBe(true);
      }
    });

    it('is refused for a template, and for a plan that is not a draft', async () => {
      const { session, client } = await ready();
      const template = (await templatesOf(session))[0];
      const plan = await clientPlan(session, client.id);
      await harness
        .as(session)
        .post(`/meal-plans/${plan.id}/activate`)
        .expect(201);

      const forTemplate = await harness
        .as(session)
        .post(`/meal-plans/${template.id}/activate`)
        .expect(409);
      const again = await harness
        .as(session)
        .post(`/meal-plans/${plan.id}/activate`)
        .expect(409);

      expect(forTemplate.body.code).toBe('MEAL_PLAN_IS_TEMPLATE');
      expect(again.body.code).toBe('MEAL_PLAN_NOT_DRAFT');
    });

    it('can end only a plan that is running', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id);

      const draft = await harness
        .as(session)
        .post(`/meal-plans/${plan.id}/end`)
        .expect(409);
      await harness
        .as(session)
        .post(`/meal-plans/${plan.id}/activate`)
        .expect(201);
      const ended = await harness
        .as(session)
        .post(`/meal-plans/${plan.id}/end`)
        .expect(201);

      expect(draft.body.code).toBe('MEAL_PLAN_NOT_ACTIVE');
      expect(ended.body.status).toBe('ended');
    });

    it('deletes a draft and a template, but keeps a plan that ran', async () => {
      const { session, client } = await ready();
      const draft = await clientPlan(session, client.id, { name: 'Draft' });
      const ran = await clientPlan(session, client.id, { name: 'Ran' });
      const template = (await templatesOf(session))[0];
      await harness
        .as(session)
        .post(`/meal-plans/${ran.id}/activate`)
        .expect(201);

      await harness.as(session).delete(`/meal-plans/${draft.id}`).expect(204);
      await harness
        .as(session)
        .delete(`/meal-plans/${template.id}`)
        .expect(204);
      const kept = await harness
        .as(session)
        .delete(`/meal-plans/${ran.id}`)
        .expect(409);
      await harness.as(session).delete(`/meal-plans/${draft.id}`).expect(404);

      expect(kept.body.code).toBe('MEAL_PLAN_NOT_DELETABLE');
      expect(await templatesOf(session)).toHaveLength(1);
    });

    it('copies any plan into a template of the coach’s own', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id, {
        name: 'Omar plan',
        caloriesKcalTarget: 1800,
      });
      await saveMeals(session, plan.id, [lunch()]).expect(200);

      const template = (
        await harness
          .as(session)
          .post(`/meal-plans/${plan.id}/save-as-template`)
          .send({ name: '  My cutting plan  ' })
          .expect(201)
      ).body as Plan;
      await saveMeals(session, plan.id, []).expect(200);
      const reread = await harness
        .as(session)
        .get(`/meal-plans/${template.id}`)
        .expect(200);

      expect(template).toMatchObject({
        isTemplate: true,
        clientId: null,
        name: 'My cutting plan',
        caloriesKcalTarget: 1800,
      });
      expect(template.meals).toHaveLength(1);
      expect(reread.body.meals).toHaveLength(1);
      await harness
        .as(session)
        .post(`/meal-plans/${plan.id}/save-as-template`)
        .send({ name: ' ' })
        .expect(400);
    });
  });

  describe('keeping each coach’s plans apart', () => {
    it('lists only the coach’s own, and does not let one coach act on another’s', async () => {
      const mine = await ready();
      const theirs = await ready();
      const plan = await clientPlan(theirs.session, theirs.client.id);

      const list = await harness
        .as(mine.session)
        .get('/meal-plans?limit=100')
        .expect(200);
      expect(list.body.total).toBe(2);
      expect(list.body.items.every((p: Plan) => p.isTemplate)).toBe(true);

      await [
        () => harness.as(mine.session).post(`/meal-plans/${plan.id}/activate`),
        () => harness.as(mine.session).post(`/meal-plans/${plan.id}/end`),
        () =>
          harness
            .as(mine.session)
            .patch(`/meal-plans/${plan.id}`)
            .send({ name: 'x' }),
        () => harness.as(mine.session).delete(`/meal-plans/${plan.id}`),
        () =>
          harness
            .as(mine.session)
            .post(`/meal-plans/${plan.id}/save-as-template`)
            .send({ name: 'x' }),
      ].reduce(async (previous, call) => {
        await previous;

        await call().expect(404);
      }, Promise.resolve());
    });
  });
  it('resolves recipe grams, portions and substitutes and keeps snapshots when copying', async () => {
    const { session } = await newCoach();
    const shared = (
      await harness.as(session).get('/recipes?scope=shared&limit=1').expect(200)
    ).body.items[0] as { id: string };
    const recipe = (
      await harness
        .as(session)
        .post(`/recipes/${shared.id}/copy`)
        .send({ nameAr: 'Plan recipe' })
        .expect(201)
    ).body as {
      id: string;
      finishedWeightG: number;
      caloriesKcalPer100g: number;
      portions: { id: string; nameAr: string; weightG: number }[];
    };
    const f = (await harness.as(session).get('/foods?limit=1').expect(200)).body
      .items[0] as {
      id: string;
      caloriesKcalPer100g: number;
      portions: { id: string }[];
    };
    const plan = (
      await harness
        .as(session)
        .post('/meal-plans')
        .send({ name: 'Recipes plan' })
        .expect(201)
    ).body as { id: string };
    const response = await harness
      .as(session)
      .put(`/meal-plans/${plan.id}/meals`)
      .send({
        meals: [
          {
            weekday: null,
            name: 'Lunch',
            items: [
              { recipeId: recipe.id, quantity: 100 },
              {
                recipeId: recipe.id,
                portionId: recipe.portions[0].id,
                quantity: 2,
              },
              {
                foodId: f.id,
                quantity: 100,
                substitutes: [{ recipeId: recipe.id, quantity: 50 }],
              },
            ],
          },
        ],
      })
      .expect(200);
    const saved = response.body as {
      meals: {
        items: {
          recipeId: string | null;
          kind: string;
          weightG: number;
          caloriesKcal: number;
          portionNameAr: string | null;
          substitutes: {
            recipeId: string;
            kind: string;
            caloriesKcal: number;
          }[];
        }[];
        totals: { caloriesKcal: number };
      }[];
      days: { caloriesKcal: number }[];
    };
    const items = saved.meals[0].items;
    expect(items[0]).toMatchObject({
      recipeId: recipe.id,
      kind: 'recipe',
      weightG: 100,
      caloriesKcal: recipe.caloriesKcalPer100g,
    });
    expect(items[1]).toMatchObject({
      recipeId: recipe.id,
      kind: 'recipe',
      weightG: 2 * recipe.portions[0].weightG,
      portionNameAr: recipe.portions[0].nameAr,
    });
    expect(items[2]).toMatchObject({ kind: 'food' });
    expect(items[2].substitutes[0]).toMatchObject({
      recipeId: recipe.id,
      kind: 'recipe',
      caloriesKcal:
        Math.round((recipe.caloriesKcalPer100g * 0.5 + Number.EPSILON) * 100) /
        100,
    });
    const total =
      Math.round(
        items.reduce((sum, item) => sum + item.caloriesKcal, 0) * 100,
      ) / 100;
    expect(saved.meals[0].totals.caloriesKcal).toBe(total);
    expect(saved.days[0].caloriesKcal).toBe(total);
    await harness
      .as(session)
      .patch(`/recipes/${recipe.id}`)
      .send({
        finishedWeightG: Math.round(recipe.finishedWeightG * 1.01 * 100) / 100,
      })
      .expect(200);
    const unchanged = await harness
      .as(session)
      .get(`/meal-plans/${plan.id}`)
      .expect(200);
    expect(unchanged.body.meals).toEqual(saved.meals);
    const copies = await Promise.all([
      harness
        .as(session)
        .post('/meal-plans')
        .send({ name: 'Copy recipe plan', fromPlanId: plan.id })
        .expect(201),
      harness
        .as(session)
        .post(`/meal-plans/${plan.id}/save-as-template`)
        .send({ name: 'Recipe template' })
        .expect(201),
    ]);
    copies.forEach((copy) => expect(copy.body.meals).toEqual(saved.meals));
    await harness
      .as(session)
      .patch(`/recipes/${recipe.id}`)
      .send({ isActive: false })
      .expect(200);
    const inactiveRead = await harness
      .as(session)
      .get(`/meal-plans/${plan.id}`)
      .expect(200);
    expect(inactiveRead.body.meals).toEqual(saved.meals);
    await harness
      .as(session)
      .put(`/meal-plans/${plan.id}/meals`)
      .send({
        meals: [
          {
            weekday: null,
            name: 'Lunch',
            items: [{ recipeId: recipe.id, quantity: 100 }],
          },
        ],
      })
      .expect(422);
  });

  it('refuses ambiguous choices, hidden recipes and a portion from another item', async () => {
    const { session } = await newCoach();
    const other = await newCoach();
    const shared = (
      await harness.as(session).get('/recipes?scope=shared&limit=1').expect(200)
    ).body.items[0] as { id: string };
    const hidden = (
      await harness
        .as(other.session)
        .post(`/recipes/${shared.id}/copy`)
        .send({})
        .expect(201)
    ).body as { id: string };
    const f = (await harness.as(session).get('/foods?limit=1').expect(200)).body
      .items[0] as { id: string; portions: { id: string }[] };
    const plan = (
      await harness
        .as(session)
        .post('/meal-plans')
        .send({ name: 'Validation' })
        .expect(201)
    ).body as { id: string };
    const save = (item: object) =>
      harness
        .as(session)
        .put(`/meal-plans/${plan.id}/meals`)
        .send({ meals: [{ weekday: null, name: 'Lunch', items: [item] }] });
    await save({ quantity: 100 }).expect(400);
    await save({ foodId: f.id, recipeId: shared.id, quantity: 100 }).expect(
      400,
    );
    await save({
      foodId: f.id,
      quantity: 100,
      substitutes: [{ quantity: 1 }],
    }).expect(400);
    await save({
      foodId: f.id,
      quantity: 100,
      substitutes: [{ foodId: f.id, recipeId: shared.id, quantity: 1 }],
    }).expect(400);
    await save({ recipeId: hidden.id, quantity: 100 })
      .expect(422)
      .expect((r) => expect(r.body.code).toBe('FOOD_NOT_AVAILABLE'));
    await save({
      foodId: f.id,
      quantity: 100,
      substitutes: [{ recipeId: hidden.id, quantity: 1 }],
    }).expect(422);
    await save({
      recipeId: shared.id,
      quantity: 100,
      portionId: f.portions[0].id,
    }).expect(422);
  });
});
