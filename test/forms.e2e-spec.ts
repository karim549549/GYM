import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { measurements } from '../src/database/schema';
import { HttpTestApp, type TestSession } from './support/http-test-app';

jest.setTimeout(60_000);

describe('The form builder over HTTP', () => {
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
      .send({ brandName: 'Forms Gym' })
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

  type Question = {
    id: string;
    position: number;
    labelAr: string;
    labelEn: string | null;
    helpText: string | null;
    inputType: string;
    options: { value: string; labelAr: string }[] | null;
    isRequired: boolean;
    unit: string | null;
    mapsToMetric: string | null;
    min: number | null;
    max: number | null;
    integer: boolean;
    maxLength: number | null;
  };
  type Form = {
    purpose: string;
    isCustom: boolean;
    version: string;
    templateId: string | null;
    questions: Question[];
  };

  const save = (session: TestSession, purpose: string, questions: unknown[]) =>
    harness.as(session).put(`/forms/${purpose}`).send({ questions });

  const intakeQuestions = () => [
    { labelAr: 'اسمك', inputType: 'short_text', isRequired: true },
    {
      labelAr: 'وزنك الآن',
      helpText: 'بالكيلوجرام',
      inputType: 'number',
      isRequired: true,
      unit: 'kg',
      min: 30,
      max: 300,
      mapsToMetric: 'weight',
    },
    {
      labelAr: 'هدفك',
      inputType: 'single_select',
      options: [
        { value: 'lose', labelAr: 'خسارة وزن' },
        { value: 'gain', labelAr: 'زيادة عضل' },
      ],
    },
    { labelAr: 'تاريخ ميلادك', inputType: 'date' },
    { labelAr: 'هل تدخن؟', inputType: 'boolean', isRequired: true },
    { labelAr: 'جودة نومك', inputType: 'scale', mapsToMetric: 'sleep_quality' },
  ];

  const current = async (session: TestSession, purpose: string) =>
    (await harness.as(session).get(`/forms/${purpose}`).expect(200))
      .body as Form;

  const cairoToday = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(
      new Date(),
    );

  describe('the built-in forms a coach starts on', () => {
    it('is the default intake form, worded in Arabic, ready to be edited', async () => {
      const { session } = await newCoach();

      const form = await current(session, 'intake');

      expect(form).toMatchObject({
        purpose: 'intake',
        isCustom: false,
        version: 'default_v1',
        templateId: null,
      });
      expect(form.questions).toHaveLength(18);
      expect(form.questions[0]).toMatchObject({
        id: 'age',
        position: 1,
        labelAr: 'العمر',
        inputType: 'number',
        isRequired: true,
      });
      const goal = form.questions.find((q) => q.id === 'goal')!;
      expect(goal.options).toContainEqual({
        value: 'fat_loss',
        labelAr: 'خسارة دهون',
      });
      const weight = form.questions.find((q) => q.id === 'weight')!;
      expect(weight).toMatchObject({ unit: 'kg', mapsToMetric: 'weight' });
    });

    it('is the default check-in, in the workspace’s units', async () => {
      const { session } = await newCoach();
      await harness
        .as(session)
        .patch('/workspaces/current')
        .send({ unitSystem: 'imperial' })
        .expect(200);

      const form = await current(session, 'checkin');

      expect(form).toMatchObject({ isCustom: false, version: 'checkin_v1' });
      expect(form.questions.find((q) => q.id === 'weight')?.unit).toBe('lb');
    });

    it('refuses a purpose nobody has', async () => {
      const { session } = await newCoach();

      await harness.as(session).get('/forms/survey').expect(400);
    });
  });

  describe('PUT /forms/:purpose', () => {
    it('saves the coach’s own form as version one, with each question filled in', async () => {
      const { session } = await newCoach();

      const form = (
        await save(session, 'intake', intakeQuestions()).expect(200)
      ).body as Form;

      expect(form).toMatchObject({
        purpose: 'intake',
        isCustom: true,
        version: 'custom_v1',
        templateId: expect.any(String),
      });
      expect(form.questions.map((q) => q.position)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(form.questions[0]).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        position: 1,
        labelAr: 'اسمك',
        labelEn: null,
        helpText: null,
        inputType: 'short_text',
        options: null,
        isRequired: true,
        unit: null,
        mapsToMetric: null,
        min: null,
        max: null,
        integer: false,
        maxLength: 300,
      });
      expect(form.questions[1]).toMatchObject({
        helpText: 'بالكيلوجرام',
        unit: 'kg',
        min: 30,
        max: 300,
        mapsToMetric: 'weight',
      });
      expect(form.questions[5]).toMatchObject({
        inputType: 'scale',
        min: 1,
        max: 10,
        integer: true,
        unit: 'score',
        mapsToMetric: 'sleep_quality',
      });
    });

    it('is what the coach is on from then, and another coach is not', async () => {
      const mine = await newCoach();
      const other = await newCoach();

      const saved = (
        await save(mine.session, 'intake', intakeQuestions()).expect(200)
      ).body as Form;

      expect(await current(mine.session, 'intake')).toEqual(saved);
      expect((await current(other.session, 'intake')).isCustom).toBe(false);
    });

    it('keeps the intake and the check-in apart', async () => {
      const { session } = await newCoach();

      await save(session, 'intake', intakeQuestions()).expect(200);

      expect((await current(session, 'checkin')).isCustom).toBe(false);
    });

    it('makes a new version on each save, and keeps the old ones readable by id', async () => {
      const { session } = await newCoach();
      const first = (
        await save(session, 'intake', intakeQuestions()).expect(200)
      ).body as Form;

      const second = (
        await save(session, 'intake', [
          { labelAr: 'سؤال جديد', inputType: 'long_text' },
        ]).expect(200)
      ).body as Form;
      const old = await harness
        .as(session)
        .get(`/forms/templates/${first.templateId}`)
        .expect(200);

      expect(second.version).toBe('custom_v2');
      expect(second.templateId).not.toBe(first.templateId);
      expect(second.questions).toHaveLength(1);
      expect(old.body).toEqual(first);
      expect((await current(session, 'intake')).templateId).toBe(
        second.templateId,
      );
    });

    it('goes back to the built-in form on delete, keeping the coach’s versions', async () => {
      const { session } = await newCoach();
      const saved = (
        await save(session, 'intake', intakeQuestions()).expect(200)
      ).body as Form;

      await harness.as(session).delete('/forms/intake').expect(204);
      await harness.as(session).delete('/forms/intake').expect(204);

      expect((await current(session, 'intake')).isCustom).toBe(false);
      await harness
        .as(session)
        .get(`/forms/templates/${saved.templateId}`)
        .expect(200);
    });

    it('carries on numbering after going back and saving again', async () => {
      const { session } = await newCoach();
      await save(session, 'intake', intakeQuestions()).expect(200);
      await harness.as(session).delete('/forms/intake').expect(204);

      const again = (
        await save(session, 'intake', intakeQuestions()).expect(200)
      ).body as Form;

      expect(again.version).toBe('custom_v2');
    });

    it('lets only one of two saves at the same moment make the next version', async () => {
      const { session } = await newCoach();
      await save(session, 'intake', intakeQuestions()).expect(200);

      const results = await Promise.all([
        save(session, 'intake', intakeQuestions()),
        save(session, 'intake', intakeQuestions()),
      ]);

      for (const result of results) {
        expect(
          result.status === 200 || result.body.code === 'FORM_VERSION_CONFLICT',
        ).toBe(true);
      }
      const succeeded = results.filter((r) => r.status === 200).length;
      expect((await current(session, 'intake')).version).toBe(
        `custom_v${1 + succeeded}`,
      );
    });

    it('can start from the built-in form: its questions saved back keep their measurements', async () => {
      const { session } = await newCoach();
      const builtIn = await current(session, 'intake');
      const questions = builtIn.questions.map(
        ({ id: _id, position: _p, ...rest }) =>
          Object.fromEntries(
            Object.entries(rest).filter(
              ([, value]) => value !== null && value !== false,
            ),
          ),
      );

      const saved = (await save(session, 'intake', questions).expect(200))
        .body as Form;

      expect(saved.questions).toHaveLength(18);
      expect(
        saved.questions
          .filter((q) => q.mapsToMetric)
          .map((q) => q.mapsToMetric)
          .sort((a, b) => String(a).localeCompare(String(b))),
      ).toEqual(
        builtIn.questions
          .filter((q) => q.mapsToMetric)
          .map((q) => q.mapsToMetric)
          .sort((a, b) => String(a).localeCompare(String(b))),
      );
    });

    it('reports every problem at once, naming where', async () => {
      const { session } = await newCoach();

      const response = await save(session, 'intake', [
        { labelAr: '   ', inputType: 'short_text' },
        { labelAr: 'رقم', inputType: 'number', min: 10, max: 1 },
        { labelAr: 'اختر', inputType: 'single_select', options: [] },
        {
          labelAr: 'وزن',
          inputType: 'number',
          mapsToMetric: 'shoe_size',
          unit: 'cm',
        },
        { labelAr: 'وزن ثان', inputType: 'number', mapsToMetric: 'weight' },
      ]).expect(422);

      expect(response.body.code).toBe('INVALID_FORM');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          'questions[0].labelAr: required',
          'questions[1].min: more than the largest',
          'questions[2].options: between 2 and 30',
          'questions[3].mapsToMetric: unknown',
          'questions[4].unit: needed for a measurement',
        ]),
      );
    });

    it('refuses two questions measuring the same thing', async () => {
      const { session } = await newCoach();
      const weight = {
        labelAr: 'وزن',
        inputType: 'number',
        unit: 'kg',
        mapsToMetric: 'weight',
      };

      const response = await save(session, 'intake', [weight, weight]).expect(
        422,
      );

      expect(response.body.details).toEqual([
        'questions[1].mapsToMetric: already used',
      ]);
    });

    it('refuses a form with no questions', async () => {
      const { session } = await newCoach();

      const response = await save(session, 'intake', []).expect(422);

      expect(response.body.details).toEqual(['questions: at least one']);
    });

    it.each([
      ['no questions list', {}],
      [
        'a question with no wording',
        { questions: [{ inputType: 'short_text' }] },
      ],
      [
        'a kind of question nobody offers',
        { questions: [{ labelAr: 'س', inputType: 'image' }] },
      ],
      [
        'a wording over 400 characters',
        { questions: [{ labelAr: 'س'.repeat(401), inputType: 'short_text' }] },
      ],
      [
        'an option with no value',
        {
          questions: [
            {
              labelAr: 'س',
              inputType: 'single_select',
              options: [{ labelAr: 'أ' }],
            },
          ],
        },
      ],
      [
        'a text longer than 2000',
        {
          questions: [
            { labelAr: 'س', inputType: 'long_text', maxLength: 2001 },
          ],
        },
      ],
    ])('refuses %s', async (_label, body) => {
      const { session } = await newCoach();

      await harness.as(session).put('/forms/intake').send(body).expect(400);
    });

    it('is not found for a version that is not there, or another coach’s', async () => {
      const mine = await newCoach();
      const theirs = await newCoach();
      const theirForm = (
        await save(theirs.session, 'intake', intakeQuestions()).expect(200)
      ).body as Form;

      const missing = await harness
        .as(mine.session)
        .get(`/forms/templates/${randomUUID()}`)
        .expect(404);
      await harness
        .as(mine.session)
        .get(`/forms/templates/${theirForm.templateId}`)
        .expect(404);
      await harness.as(mine.session).get('/forms/templates/nope').expect(400);

      expect(missing.body.code).toBe('FORM_NOT_FOUND');
    });
  });

  describe('a client answering the coach’s own intake form', () => {
    const ready = async () => {
      const coach = await newCoach();
      const client = await addClient(coach.session);
      const form = (
        await save(coach.session, 'intake', intakeQuestions()).expect(200)
      ).body as Form;
      const link = (
        await harness
          .as(coach.session)
          .post(`/clients/${client.id}/intake-link`)
          .expect(201)
      ).body as { token: string };
      const key = (position: number) => form.questions[position - 1].id;
      return { ...coach, client, form, link, key };
    };

    const open = (token: string) =>
      harness.server().get(`/api/v1/intake/${token}`);
    const submit = (token: string, answers: Record<string, unknown>) =>
      harness
        .server()
        .post(`/api/v1/intake/${token}`)
        .send({ answers, consents: HttpTestApp.ALL_CLIENT_CONSENTS });

    it('shows the coach’s questions, with their wording and options', async () => {
      const { link, form } = await ready();

      const response = await open(link.token).expect(200);

      expect(response.body.form).toMatchObject({
        version: 'custom_v1',
        templateId: form.templateId,
      });
      expect(response.body.form.questions[0]).toMatchObject({
        id: form.questions[0].id,
        labelAr: 'اسمك',
        required: true,
      });
      expect(response.body.form.questions[2]).toMatchObject({
        labelAr: 'هدفك',
        type: 'single_select',
        options: ['lose', 'gain'],
        choices: [
          { value: 'lose', labelAr: 'خسارة وزن' },
          { value: 'gain', labelAr: 'زيادة عضل' },
        ],
      });
    });

    it('keeps the answers by question, on that version, and writes the tagged numbers as measurements', async () => {
      const { link, session, client, workspaceId, form, key } = await ready();

      await submit(link.token, {
        [key(1)]: 'Omar',
        [key(2)]: 82.5,
        [key(3)]: 'lose',
        [key(4)]: '1994-03-21',
        [key(5)]: false,
        [key(6)]: 7,
      }).expect(201);
      const response = await harness
        .as(session)
        .get(`/clients/${client.id}/intake`)
        .expect(200);
      const stored = await harness.tx.run(
        () =>
          harness.tx.db
            .select({
              metric: measurements.metric,
              value: measurements.value,
              unit: measurements.unit,
            })
            .from(measurements)
            .where(eq(measurements.clientId, client.id)),
        { workspaceId },
      );

      expect(response.body).toEqual({
        submittedAt: expect.any(String),
        submittedBy: 'client',
        formVersion: 'custom_v1',
        templateId: form.templateId,
        answers: {
          [key(1)]: 'Omar',
          [key(2)]: 82.5,
          [key(3)]: 'lose',
          [key(4)]: '1994-03-21',
          [key(5)]: false,
          [key(6)]: 7,
        },
      });
      expect(stored).toEqual(
        expect.arrayContaining([
          { metric: 'weight', value: 82.5, unit: 'kg' },
          { metric: 'sleep_quality', value: 7, unit: 'score' },
        ]),
      );
    });

    it('enforces what the coach made required and the range they set', async () => {
      const { link, key } = await ready();

      const response = await submit(link.token, {
        [key(2)]: 29,
        [key(4)]: '1994-02-30',
        [key(3)]: 'maintain',
        [randomUUID()]: 'x',
      }).expect(422);

      expect(response.body.code).toBe('INVALID_INTAKE_ANSWERS');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          `${key(1)}: required`,
          `${key(2)}: invalid`,
          `${key(3)}: invalid`,
          `${key(4)}: invalid`,
          `${key(5)}: required`,
        ]),
      );
      expect(
        response.body.details.some((d: string) => d.endsWith(': unknown')),
      ).toBe(true);
    });

    it('does not accept the built-in form’s keys once the coach has their own', async () => {
      const { link } = await ready();

      const response = await submit(link.token, { age: 30, weight: 80 }).expect(
        422,
      );

      expect(response.body.details).toEqual(
        expect.arrayContaining(['age: unknown', 'weight: unknown']),
      );
    });

    it('opens the coach’s newest version on a link sent earlier', async () => {
      const { link, session } = await ready();
      const next = (
        await save(session, 'intake', [
          { labelAr: 'سؤال واحد', inputType: 'short_text' },
        ]).expect(200)
      ).body as Form;

      const response = await open(link.token).expect(200);

      expect(response.body.form).toMatchObject({
        version: 'custom_v2',
        templateId: next.templateId,
      });
      expect(response.body.form.questions).toHaveLength(1);
    });

    it('goes back to the built-in form when the coach does', async () => {
      const { link, session } = await ready();
      await harness.as(session).delete('/forms/intake').expect(204);

      const response = await open(link.token).expect(200);

      expect(response.body.form.version).toBe('default_v1');
    });
  });

  describe('a client answering the coach’s own check-in', () => {
    it('shows the coach’s questions and writes their tagged numbers as measurements', async () => {
      const { session, workspaceId } = await newCoach();
      const client = await addClient(session);
      await harness.grantClientConsents(workspaceId, client.id);
      const form = (
        await save(session, 'checkin', [
          {
            labelAr: 'وزنك',
            inputType: 'number',
            isRequired: true,
            unit: 'kg',
            mapsToMetric: 'weight',
          },
          { labelAr: 'كيف كان أسبوعك؟', inputType: 'long_text' },
        ]).expect(200)
      ).body as Form;
      await harness
        .as(session)
        .put(`/clients/${client.id}/checkin-schedule`)
        .send({ frequency: 'daily' })
        .expect(200);
      const items = (
        await harness
          .as(session)
          .get(`/checkins?clientId=${client.id}&limit=100`)
          .expect(200)
      ).body.items as { id: string; dueOn: string; link: string }[];
      const today = items.find((i) => i.dueOn === cairoToday())!;
      const token = today.link.split('/').pop();

      const opened = await harness
        .server()
        .get(`/api/v1/checkin/${token}`)
        .expect(200);
      await harness
        .server()
        .post(`/api/v1/checkin/${token}`)
        .send({
          answers: {
            [form.questions[0].id]: 81,
            [form.questions[1].id]: 'Good',
          },
        })
        .expect(201);
      const read = await harness
        .as(session)
        .get(`/checkins/${today.id}`)
        .expect(200);
      const stored = await harness.tx.run(
        () =>
          harness.tx.db
            .select({ metric: measurements.metric, value: measurements.value })
            .from(measurements)
            .where(eq(measurements.clientId, client.id)),
        { workspaceId },
      );

      expect(opened.body.form).toMatchObject({
        version: 'custom_v1',
        templateId: form.templateId,
      });
      expect(
        opened.body.form.questions.map((q: { labelAr: string }) => q.labelAr),
      ).toEqual(['وزنك', 'كيف كان أسبوعك؟']);
      expect(read.body).toMatchObject({
        status: 'submitted',
        formVersion: 'custom_v1',
        templateId: form.templateId,
      });
      expect(stored).toEqual([{ metric: 'weight', value: 81 }]);
    });
  });
});
