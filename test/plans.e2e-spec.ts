import { randomUUID } from 'node:crypto';
import { HttpTestApp, type TestSession } from './support/http-test-app';

jest.setTimeout(60_000);

describe('Workout plans over HTTP', () => {
  let harness: HttpTestApp;
  let ids: Record<string, string>;

  beforeAll(async () => {
    harness = await HttpTestApp.start();
    const { session } = await newCoach();
    const library = await harness
      .as(session)
      .get('/exercises?limit=100')
      .expect(200);
    ids = Object.fromEntries(
      library.body.items.map((e: { slug: string; id: string }) => [
        e.slug,
        e.id,
      ]),
    );
  });

  afterAll(() => harness.stop(), 60_000);

  const newCoach = async () => {
    const { session } = await harness.signedUpPerson();
    const created = await harness
      .as(session)
      .post('/workspaces')
      .send({ brandName: 'Plans Gym' })
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

  type Plan = {
    id: string;
    clientId: string | null;
    isTemplate: boolean;
    name: string;
    goal: string | null;
    weeks: number;
    status: string;
    startsOn: string | null;
    notes: string | null;
    days: {
      weekNo: number;
      dayNo: number;
      name: string | null;
      isRest: boolean;
      isDeload: boolean;
      notes: string | null;
      exercises: {
        position: number;
        exerciseId: string;
        exerciseName: string;
        coachNote: string | null;
        supersetGroup: string | null;
        sets: {
          setNo: number;
          reps: string | null;
          weightKg: number | null;
          weightPct: number | null;
          restSeconds: number | null;
          rir: number | null;
        }[];
      }[];
    }[];
  };

  const make = (session: TestSession, body: Record<string, unknown>) =>
    harness.as(session).post('/plans').send(body);

  const clientPlan = async (
    session: TestSession,
    clientId: string,
    body: Record<string, unknown> = {},
  ) =>
    (await make(session, { name: 'Plan', clientId, ...body }).expect(201))
      .body as Plan;

  const saveDays = (session: TestSession, planId: string, days: unknown[]) =>
    harness.as(session).put(`/plans/${planId}/days`).send({ days });

  const day = (overrides: Record<string, unknown> = {}) => ({
    weekNo: 1,
    dayNo: 1,
    name: 'Chest',
    exercises: [
      {
        exerciseId: ids['barbell-bench-press'],
        coachNote: 'Slow down',
        sets: [
          { reps: '8-10', weightKg: 60, restSeconds: 90, rir: 2 },
          { reps: 'AMRAP', weightPct: 75.5 },
        ],
      },
    ],
    ...overrides,
  });

  const templatesOf = async (session: TestSession) =>
    (
      await harness
        .as(session)
        .get('/plans?template=true&limit=100')
        .expect(200)
    ).body.items as { id: string; name: string; weeks: number }[];

  describe('the templates a new coach starts with', () => {
    it('are three, one week each, named in Arabic', async () => {
      const { session } = await newCoach();

      const templates = await templatesOf(session);

      expect(templates).toHaveLength(3);
      expect(templates.map((t) => t.name).sort()).toEqual(
        [
          'جسم كامل - 3 أيام',
          'دفع / سحب / أرجل - 6 أيام',
          'علوي / سفلي - 4 أيام',
        ].sort(),
      );
      expect(templates.every((t) => t.weeks === 1)).toBe(true);
    });

    it('hold days of library exercises, three sets of 8 to 12 with 90 seconds rest', async () => {
      const { session } = await newCoach();
      const full = (await templatesOf(session)).find((t) =>
        t.name.startsWith('جسم كامل'),
      )!;

      const plan = (
        await harness.as(session).get(`/plans/${full.id}`).expect(200)
      ).body as Plan;

      expect(plan.isTemplate).toBe(true);
      expect(plan.clientId).toBeNull();
      expect(plan.days.map((d) => d.dayNo)).toEqual([1, 3, 5]);
      const first = plan.days[0].exercises[0];
      expect(first).toMatchObject({
        position: 1,
        exerciseId: ids['back-squat'],
        exerciseName: 'سكوات بالبار',
      });
      expect(first.sets).toEqual([
        {
          setNo: 1,
          reps: '8-12',
          weightKg: null,
          weightPct: null,
          restSeconds: 90,
          rir: null,
        },
        {
          setNo: 2,
          reps: '8-12',
          weightKg: null,
          weightPct: null,
          restSeconds: 90,
          rir: null,
        },
        {
          setNo: 3,
          reps: '8-12',
          weightKg: null,
          weightPct: null,
          restSeconds: 90,
          rir: null,
        },
      ]);
    });

    it('are the coach’s own: another coach’s changes do not touch them', async () => {
      const mine = await newCoach();
      const other = await newCoach();
      const template = (await templatesOf(mine.session))[0];

      await harness.as(other.session).get(`/plans/${template.id}`).expect(404);
    });
  });

  describe('POST /plans', () => {
    it('starts a client’s plan as a draft, four weeks long, with no days yet', async () => {
      const { session, client } = await ready();

      const response = await make(session, {
        name: '  Cutting  ',
        goal: 'Fat loss',
        notes: 'Be strict',
        clientId: client.id,
      }).expect(201);

      expect(response.body).toEqual({
        id: expect.any(String),
        clientId: client.id,
        isTemplate: false,
        name: 'Cutting',
        goal: 'Fat loss',
        weeks: 4,
        status: 'draft',
        startsOn: null,
        notes: 'Be strict',
        createdAt: expect.any(String),
        days: [],
      });
    });

    it('is a template when it has no client', async () => {
      const { session } = await newCoach();

      const response = await make(session, { name: 'Mine', weeks: 6 }).expect(
        201,
      );

      expect(response.body).toMatchObject({
        isTemplate: true,
        clientId: null,
        weeks: 6,
      });
    });

    it('copies a template for a client, the usual way to start', async () => {
      const { session, client } = await ready();
      const ppl = (await templatesOf(session)).find((t) =>
        t.name.startsWith('دفع'),
      )!;
      const source = (
        await harness.as(session).get(`/plans/${ppl.id}`).expect(200)
      ).body as Plan;

      const copy = (
        await make(session, {
          name: 'For Omar',
          clientId: client.id,
          fromPlanId: ppl.id,
        }).expect(201)
      ).body as Plan;

      expect(copy.id).not.toBe(source.id);
      expect(copy).toMatchObject({
        isTemplate: false,
        clientId: client.id,
        status: 'draft',
        goal: source.goal,
        weeks: source.weeks,
      });
      expect(copy.days).toEqual(source.days);
    });

    it('can be made longer than the template it copies, never shorter', async () => {
      const { session, client } = await ready();
      const template = (await templatesOf(session))[0];

      const longer = await make(session, {
        name: 'Longer',
        clientId: client.id,
        fromPlanId: template.id,
        weeks: 8,
      }).expect(201);
      const shorter = await make(session, {
        name: 'Shorter',
        clientId: client.id,
        fromPlanId: longer.body.id,
        weeks: 3,
      }).expect(422);

      expect(longer.body.weeks).toBe(8);
      expect(shorter.body.code).toBe('PLAN_HAS_LATER_WEEKS');
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
      expect(source.body.code).toBe('PLAN_NOT_FOUND');
    });

    it.each([
      ['no name', { name: undefined }],
      ['a blank name', { name: '   ' }],
      ['a name over 120 characters', { name: 'x'.repeat(121) }],
      ['no weeks at all', { weeks: 0 }],
      ['more than a year', { weeks: 53 }],
      ['half a week', { weeks: 1.5 }],
      ['a client that is not an id', { clientId: 'omar' }],
      ['a source that is not an id', { fromPlanId: 'template' }],
    ])('refuses %s', async (_label, change) => {
      const { session } = await ready();

      await make(session, { name: 'Plan', ...change }).expect(400);
    });
  });

  describe('GET /plans', () => {
    it('lists plans without their days, newest first, and filters', async () => {
      const { session, client } = await ready();
      const other = await addClient(session);
      const first = await clientPlan(session, client.id, { name: 'First' });
      const second = await clientPlan(session, other.id, { name: 'Second' });

      const mineAll = await harness
        .as(session)
        .get('/plans?template=false')
        .expect(200);
      const forClient = await harness
        .as(session)
        .get(`/plans?clientId=${client.id}`)
        .expect(200);
      const drafts = await harness
        .as(session)
        .get('/plans?status=active')
        .expect(200);

      expect(mineAll.body.items.map((p: Plan) => p.id)).toEqual([
        second.id,
        first.id,
      ]);
      expect(mineAll.body.items[0]).not.toHaveProperty('days');
      expect(forClient.body.items.map((p: Plan) => p.id)).toEqual([first.id]);
      expect(drafts.body.items).toEqual([]);
    });

    it('refuses a status nobody uses', async () => {
      const { session } = await ready();

      await harness.as(session).get('/plans?status=paused').expect(400);
    });
  });

  describe('GET and PATCH /plans/:id', () => {
    it('is not found for an id that is not there, and refuses one that is not an id', async () => {
      const { session } = await ready();

      const missing = await harness
        .as(session)
        .get(`/plans/${randomUUID()}`)
        .expect(404);
      await harness.as(session).get('/plans/nope').expect(400);

      expect(missing.body.code).toBe('PLAN_NOT_FOUND');
    });

    it('changes what was sent and leaves the rest, and null clears a goal', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id, { goal: 'Strength' });

      const response = await harness
        .as(session)
        .patch(`/plans/${plan.id}`)
        .send({ name: 'Renamed', goal: null, weeks: 6 })
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'Renamed',
        goal: null,
        weeks: 6,
      });
    });

    it('does not shorten a plan below the last week it has days in', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id, { weeks: 4 });
      await saveDays(session, plan.id, [day({ weekNo: 3 })]).expect(200);

      const response = await harness
        .as(session)
        .patch(`/plans/${plan.id}`)
        .send({ weeks: 2 })
        .expect(422);

      expect(response.body.code).toBe('PLAN_HAS_LATER_WEEKS');
    });
  });

  describe('PUT /plans/:id/days', () => {
    it('saves the whole plan: days in order, each exercise with its name and its sets numbered', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id, { weeks: 2 });

      const response = await saveDays(session, plan.id, [
        day({ weekNo: 2, dayNo: 1 }),
        day({
          weekNo: 1,
          dayNo: 3,
          name: 'Legs',
          isDeload: true,
          notes: 'Easy week',
          exercises: [
            { exerciseId: ids['back-squat'], sets: [{ reps: '5' }] },
            {
              exerciseId: ids['leg-press'],
              supersetGroup: 'A',
              sets: [{ reps: '12' }],
            },
            {
              exerciseId: ids['leg-curl'],
              supersetGroup: 'A',
              sets: [{ reps: '12' }],
            },
          ],
        }),
        day({ weekNo: 1, dayNo: 5, name: 'Rest', isRest: true, exercises: [] }),
      ]).expect(200);

      const body = response.body as Plan;
      expect(body.days.map((d) => [d.weekNo, d.dayNo])).toEqual([
        [1, 3],
        [1, 5],
        [2, 1],
      ]);
      expect(body.days[0]).toMatchObject({
        name: 'Legs',
        isDeload: true,
        isRest: false,
        notes: 'Easy week',
      });
      expect(
        body.days[0].exercises.map((e) => [
          e.position,
          e.exerciseName,
          e.supersetGroup,
        ]),
      ).toEqual([
        [1, 'سكوات بالبار', null],
        [2, 'ضغط رجل', 'A'],
        [3, 'رفرفة خلفي للفخذ', 'A'],
      ]);
      expect(body.days[1]).toMatchObject({ isRest: true, exercises: [] });
      expect(body.days[2].exercises[0]).toMatchObject({
        exerciseName: 'ضغط بنش بالبار',
        coachNote: 'Slow down',
        sets: [
          {
            setNo: 1,
            reps: '8-10',
            weightKg: 60,
            weightPct: null,
            restSeconds: 90,
            rir: 2,
          },
          {
            setNo: 2,
            reps: 'AMRAP',
            weightKg: null,
            weightPct: 75.5,
            restSeconds: null,
            rir: null,
          },
        ],
      });
    });

    it('returns the same thing when read back', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id);

      const saved = await saveDays(session, plan.id, [day()]).expect(200);
      const read = await harness
        .as(session)
        .get(`/plans/${plan.id}`)
        .expect(200);

      expect(read.body).toEqual(saved.body);
    });

    it('replaces what was there: days not listed are removed', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id);
      await saveDays(session, plan.id, [day(), day({ dayNo: 2 })]).expect(200);

      const response = await saveDays(session, plan.id, [
        day({ dayNo: 4 }),
      ]).expect(200);

      expect(response.body.days.map((d: { dayNo: number }) => d.dayNo)).toEqual(
        [4],
      );
    });

    it('can be emptied', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id);
      await saveDays(session, plan.id, [day()]).expect(200);

      const response = await saveDays(session, plan.id, []).expect(200);

      expect(response.body.days).toEqual([]);
    });

    it('keeps the name an exercise had when it was added, even after the exercise is renamed', async () => {
      const { session, client } = await ready();
      const custom = (
        await harness
          .as(session)
          .post('/exercises')
          .send({ nameAr: 'اسم قديم', nameEn: 'Old', primaryMuscle: 'chest' })
          .expect(201)
      ).body as { id: string };
      const plan = await clientPlan(session, client.id);
      await saveDays(session, plan.id, [
        day({ exercises: [{ exerciseId: custom.id, sets: [{ reps: '10' }] }] }),
      ]).expect(200);

      await harness
        .as(session)
        .patch(`/exercises/${custom.id}`)
        .send({ nameAr: 'اسم جديد' })
        .expect(200);
      const read = await harness
        .as(session)
        .get(`/plans/${plan.id}`)
        .expect(200);

      expect(read.body.days[0].exercises[0].exerciseName).toBe('اسم قديم');
    });

    it('refuses an exercise the coach cannot use, naming where it is', async () => {
      const mine = await ready();
      const theirs = await newCoach();
      const theirExercise = (
        await harness
          .as(theirs.session)
          .post('/exercises')
          .send({ nameAr: 'خاص', nameEn: 'Private', primaryMuscle: 'chest' })
          .expect(201)
      ).body as { id: string };
      const plan = await clientPlan(mine.session, mine.client.id);

      const response = await saveDays(mine.session, plan.id, [
        day(),
        day({
          dayNo: 2,
          exercises: [
            { exerciseId: ids['plank'], sets: [{ reps: '30 sec' }] },
            { exerciseId: theirExercise.id, sets: [{ reps: '10' }] },
          ],
        }),
        day({
          dayNo: 3,
          exercises: [{ exerciseId: randomUUID(), sets: [{ reps: '10' }] }],
        }),
      ]).expect(422);

      expect(response.body.code).toBe('EXERCISE_NOT_AVAILABLE');
      expect(response.body.details).toEqual([
        'days[1].exercises[1].exerciseId: unavailable',
        'days[2].exercises[0].exerciseId: unavailable',
      ]);
      const read = await harness
        .as(mine.session)
        .get(`/plans/${plan.id}`)
        .expect(200);
      expect(read.body.days).toEqual([]);
    });

    it('refuses a deactivated exercise for a plan that does not hold it yet, but a plan that holds it keeps it', async () => {
      const { session, client } = await ready();
      const custom = (
        await harness
          .as(session)
          .post('/exercises')
          .send({ nameAr: 'تمرين', nameEn: 'Move', primaryMuscle: 'chest' })
          .expect(201)
      ).body as { id: string };
      const holding = await clientPlan(session, client.id, { name: 'Holding' });
      const empty = await clientPlan(session, client.id, { name: 'Empty' });
      const use = (planId: string) =>
        saveDays(session, planId, [
          day({
            exercises: [{ exerciseId: custom.id, sets: [{ reps: '10' }] }],
          }),
        ]);
      await use(holding.id).expect(200);
      await harness
        .as(session)
        .patch(`/exercises/${custom.id}`)
        .send({ isActive: false })
        .expect(200);

      await use(holding.id).expect(200);
      const refused = await use(empty.id).expect(422);

      expect(refused.body.code).toBe('EXERCISE_NOT_AVAILABLE');
    });

    it('reports every structure problem at once', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id, { weeks: 2 });

      const response = await saveDays(session, plan.id, [
        day(),
        day(),
        day({ dayNo: 2, weekNo: 3 }),
        day({ dayNo: 3, isRest: true }),
        day({
          dayNo: 4,
          exercises: [
            {
              exerciseId: ids['plank'],
              supersetGroup: 'A',
              sets: [{ reps: '1' }],
            },
          ],
        }),
      ]).expect(422);

      expect(response.body.code).toBe('INVALID_PLAN_STRUCTURE');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          'days[1]: duplicate',
          'days[2].weekNo: beyond the plan',
          'days[3]: a rest day has no exercises',
          'days[4].exercises[0].supersetGroup: alone',
        ]),
      );
    });

    it.each([
      ['a day 8 of the week', { dayNo: 8 }],
      ['a day 0', { dayNo: 0 }],
      ['week 53', { weekNo: 53 }],
      ['no exercises list', { exercises: undefined }],
      [
        'reps over 30 characters',
        { exercises: [{ exerciseId: 'x', sets: [{ reps: 'y'.repeat(31) }] }] },
      ],
    ])('refuses %s', async (_label, change) => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id);

      await saveDays(session, plan.id, [day(change)]).expect(400);
    });

    it.each([
      ['a weight over 1000 kg', { weightKg: 1001 }],
      ['a negative weight', { weightKg: -1 }],
      ['a weight of three decimals', { weightKg: 60.123 }],
      ['a percentage over 200', { weightPct: 201 }],
      ['rest over an hour', { restSeconds: 3601 }],
      ['reps in reserve over 10', { rir: 11 }],
      ['reps in reserve of two decimals', { rir: 1.25 }],
    ])('refuses a set with %s', async (_label, set) => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id);

      await saveDays(session, plan.id, [
        day({ exercises: [{ exerciseId: ids['plank'], sets: [set] }] }),
      ]).expect(400);
    });

    it('refuses more than 30 exercises on a day and 20 sets on an exercise', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id);
      const exercise = (sets: number) => ({
        exerciseId: ids['plank'],
        sets: Array.from({ length: sets }, () => ({ reps: '1' })),
      });

      await saveDays(session, plan.id, [
        day({ exercises: Array.from({ length: 31 }, () => exercise(1)) }),
      ]).expect(400);
      await saveDays(session, plan.id, [
        day({ exercises: [exercise(21)] }),
      ]).expect(400);
    });

    it('saves a long plan, far over a hundred kilobytes', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id, { weeks: 12 });
      const slugs = Object.keys(ids).slice(0, 8);
      const days = Array.from({ length: 12 }, (_w, week) =>
        Array.from({ length: 6 }, (_d, d) => ({
          weekNo: week + 1,
          dayNo: d + 1,
          name: `Week ${week + 1} day ${d + 1}`,
          exercises: slugs.map((slug) => ({
            exerciseId: ids[slug],
            coachNote: 'Keep the tempo',
            sets: Array.from({ length: 4 }, () => ({
              reps: '8-10',
              weightKg: 42.5,
              restSeconds: 90,
              rir: 2,
            })),
          })),
        })),
      ).flat();
      expect(JSON.stringify({ days }).length).toBeGreaterThan(100_000);

      const response = await saveDays(session, plan.id, days).expect(200);

      expect(response.body.days).toHaveLength(72);
      expect(
        response.body.days.reduce(
          (sum: number, d: Plan['days'][number]) =>
            sum + d.exercises.reduce((s, e) => s + e.sets.length, 0),
          0,
        ),
      ).toBe(72 * 8 * 4);
    });

    it('does not change a plan that ended', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id);
      await harness.as(session).post(`/plans/${plan.id}/activate`).expect(201);
      await harness.as(session).post(`/plans/${plan.id}/end`).expect(201);

      const response = await saveDays(session, plan.id, [day()]).expect(409);

      expect(response.body.code).toBe('PLAN_ENDED');
    });

    it('does not reach another coach’s plan', async () => {
      const mine = await ready();
      const theirs = await ready();
      const plan = await clientPlan(theirs.session, theirs.client.id);

      await saveDays(mine.session, plan.id, [day()]).expect(404);
    });
  });

  describe('activating, ending and removing', () => {
    it('starts a draft: the client follows it from today, or from the day given', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id);
      const other = await clientPlan(session, client.id, { name: 'Later' });

      const today = await harness
        .as(session)
        .post(`/plans/${plan.id}/activate`)
        .expect(201);
      await harness.as(session).post(`/plans/${plan.id}/end`).expect(201);
      const dated = await harness
        .as(session)
        .post(`/plans/${other.id}/activate`)
        .send({ startsOn: '2030-05-01' })
        .expect(201);

      expect(today.body).toMatchObject({
        status: 'active',
        startsOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      });
      expect(dated.body).toMatchObject({
        status: 'active',
        startsOn: '2030-05-01',
      });
    });

    it('ends the plan the client was following when a new one starts', async () => {
      const { session, client } = await ready();
      const first = await clientPlan(session, client.id, { name: 'First' });
      const second = await clientPlan(session, client.id, { name: 'Second' });
      await harness.as(session).post(`/plans/${first.id}/activate`).expect(201);

      await harness
        .as(session)
        .post(`/plans/${second.id}/activate`)
        .expect(201);
      const old = await harness
        .as(session)
        .get(`/plans/${first.id}`)
        .expect(200);

      expect(old.body.status).toBe('ended');
    });

    it('leaves exactly one plan running when two are started at the same moment', async () => {
      const { session, client } = await ready();
      const a = await clientPlan(session, client.id, { name: 'A' });
      const b = await clientPlan(session, client.id, { name: 'B' });

      const results = await Promise.all([
        harness.as(session).post(`/plans/${a.id}/activate`),
        harness.as(session).post(`/plans/${b.id}/activate`),
      ]);

      const active = await harness
        .as(session)
        .get(`/plans?clientId=${client.id}&status=active`)
        .expect(200);
      expect(active.body.items).toHaveLength(1);
      // a start that lost the race is told to try again; one that did not is simply done
      for (const result of results) {
        expect(
          result.status === 201 ||
            result.body.code === 'PLAN_ACTIVATION_CONFLICT',
        ).toBe(true);
      }
    });

    it('is refused for a template, and for a plan that is not a draft', async () => {
      const { session, client } = await ready();
      const template = (await templatesOf(session))[0];
      const plan = await clientPlan(session, client.id);
      await harness.as(session).post(`/plans/${plan.id}/activate`).expect(201);

      const forTemplate = await harness
        .as(session)
        .post(`/plans/${template.id}/activate`)
        .expect(409);
      const again = await harness
        .as(session)
        .post(`/plans/${plan.id}/activate`)
        .expect(409);

      expect(forTemplate.body.code).toBe('PLAN_IS_TEMPLATE');
      expect(again.body.code).toBe('PLAN_NOT_DRAFT');
    });

    it('can end only a plan that is running', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id);

      const draft = await harness
        .as(session)
        .post(`/plans/${plan.id}/end`)
        .expect(409);
      await harness.as(session).post(`/plans/${plan.id}/activate`).expect(201);
      const ended = await harness
        .as(session)
        .post(`/plans/${plan.id}/end`)
        .expect(201);

      expect(draft.body.code).toBe('PLAN_NOT_ACTIVE');
      expect(ended.body.status).toBe('ended');
    });

    it('deletes a draft and a template, but keeps a plan that ran', async () => {
      const { session, client } = await ready();
      const draft = await clientPlan(session, client.id, { name: 'Draft' });
      const ran = await clientPlan(session, client.id, { name: 'Ran' });
      const template = (await templatesOf(session))[0];
      await harness.as(session).post(`/plans/${ran.id}/activate`).expect(201);

      await harness.as(session).delete(`/plans/${draft.id}`).expect(204);
      await harness.as(session).delete(`/plans/${template.id}`).expect(204);
      const kept = await harness
        .as(session)
        .delete(`/plans/${ran.id}`)
        .expect(409);
      await harness.as(session).delete(`/plans/${draft.id}`).expect(404);

      expect(kept.body.code).toBe('PLAN_NOT_DELETABLE');
      expect(await templatesOf(session)).toHaveLength(2);
    });

    it('removes the days with the plan', async () => {
      const { session, workspaceId, client } = await ready();
      const draft = await clientPlan(session, client.id);
      await saveDays(session, draft.id, [day()]).expect(200);

      await harness.as(session).delete(`/plans/${draft.id}`).expect(204);

      const left = await harness.tx.run(
        () =>
          harness.tx.db.execute(
            `select count(*)::int as n from plan_days where plan_id = '${draft.id}'` as never,
          ),
        { workspaceId },
      );
      expect((left as unknown as { rows: { n: number }[] }).rows[0].n).toBe(0);
    });
  });

  describe('POST /plans/:id/save-as-template', () => {
    it('copies a client’s plan into a template of the coach’s own, which then changes on its own', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id, {
        name: 'Omar plan',
        goal: 'Strength',
        weeks: 3,
      });
      await saveDays(session, plan.id, [
        day({ weekNo: 3 }),
        day({ weekNo: 1, dayNo: 2 }),
      ]).expect(200);

      const template = (
        await harness
          .as(session)
          .post(`/plans/${plan.id}/save-as-template`)
          .send({ name: '  My strength block  ' })
          .expect(201)
      ).body as Plan;
      await saveDays(session, plan.id, []).expect(200);
      const reread = await harness
        .as(session)
        .get(`/plans/${template.id}`)
        .expect(200);

      expect(template).toMatchObject({
        isTemplate: true,
        clientId: null,
        name: 'My strength block',
        goal: 'Strength',
        weeks: 3,
        status: 'draft',
      });
      expect(template.days).toHaveLength(2);
      expect(reread.body.days).toHaveLength(2);
    });

    it('needs a name', async () => {
      const { session, client } = await ready();
      const plan = await clientPlan(session, client.id);

      await harness
        .as(session)
        .post(`/plans/${plan.id}/save-as-template`)
        .send({ name: ' ' })
        .expect(400);
    });
  });

  describe('keeping each coach’s plans apart', () => {
    it('lists only the coach’s own, templates included', async () => {
      const mine = await ready();
      const theirs = await ready();
      await clientPlan(theirs.session, theirs.client.id);

      const list = await harness
        .as(mine.session)
        .get('/plans?limit=100')
        .expect(200);

      expect(list.body.total).toBe(3);
      expect(list.body.items.every((p: Plan) => p.isTemplate)).toBe(true);
    });

    it('does not let one coach start, end, change or remove another’s', async () => {
      const mine = await ready();
      const theirs = await ready();
      const plan = await clientPlan(theirs.session, theirs.client.id);

      for (const call of [
        () => harness.as(mine.session).post(`/plans/${plan.id}/activate`),
        () => harness.as(mine.session).post(`/plans/${plan.id}/end`),
        () =>
          harness
            .as(mine.session)
            .patch(`/plans/${plan.id}`)
            .send({ name: 'x' }),
        () => harness.as(mine.session).delete(`/plans/${plan.id}`),
        () =>
          harness
            .as(mine.session)
            .post(`/plans/${plan.id}/save-as-template`)
            .send({ name: 'x' }),
      ]) {
        await call().expect(404);
      }
    });
  });
});
