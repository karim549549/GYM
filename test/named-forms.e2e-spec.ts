import { randomUUID } from 'node:crypto';
import { HttpTestApp, type TestSession } from './support/http-test-app';

jest.setTimeout(60_000);

describe('Named forms over HTTP', () => {
  let harness: HttpTestApp;

  beforeAll(async () => {
    harness = await HttpTestApp.start();
  });

  afterAll(() => harness.stop(), 60_000);

  const newCoach = async (brandName = 'Named Forms Gym') => {
    const { session } = await harness.signedUpPerson();
    const created = await harness
      .as(session)
      .post('/workspaces')
      .send({ brandName })
      .expect(201);
    harness.trackWorkspace(created.body.id);
    return { session };
  };

  const addClient = async (session: TestSession) =>
    (
      await harness
        .as(session)
        .post('/clients')
        .send({ fullName: 'Omar Khaled', phone: harness.uniquePhone() })
        .expect(201)
    ).body as { id: string };

  const questions = (label = 'ما هو هدفك؟') => [
    { labelAr: label, inputType: 'short_text', isRequired: true },
    { labelAr: 'عمرك', inputType: 'number', isRequired: false, unit: 'years' },
  ];

  const create = (session: TestSession, name: string, body = questions()) =>
    harness
      .as(session)
      .post('/named-forms')
      .send({ purpose: 'intake', name, questions: body });

  const list = (session: TestSession) =>
    harness.as(session).get('/named-forms?purpose=intake');

  it('starts with none', async () => {
    const { session } = await newCoach();

    expect((await list(session).expect(200)).body).toEqual([]);
  });

  it('creates a named form with its first version and lists it', async () => {
    const { session } = await newCoach();

    const made = await create(session, 'Weight loss').expect(201);
    const listed = (await list(session).expect(200)).body;

    expect(made.body).toMatchObject({
      id: expect.any(String),
      name: 'Weight loss',
      purpose: 'intake',
      isCustom: true,
      version: 'custom_v1',
    });
    expect(made.body.questions).toHaveLength(2);
    expect(listed).toEqual([
      {
        id: made.body.id,
        purpose: 'intake',
        name: 'Weight loss',
        version: 1,
        questionCount: 2,
      },
    ]);
  });

  it('keeps several forms apart, each with its own versions', async () => {
    const { session } = await newCoach();
    const a = (await create(session, 'A').expect(201)).body;
    const b = (await create(session, 'B', questions('سؤال آخر')).expect(201))
      .body;

    const changed = await harness
      .as(session)
      .put(`/named-forms/${a.id}`)
      .send({ questions: [...questions(), questions('ثالث')[0]] })
      .expect(200);
    const untouched = await harness
      .as(session)
      .get(`/named-forms/${b.id}`)
      .expect(200);

    expect(changed.body.version).toBe('custom_v2');
    expect(changed.body.questions).toHaveLength(3);
    expect(untouched.body.version).toBe('custom_v1');
    expect(untouched.body.questions).toHaveLength(2);
  });

  it('renames a form without making a new version', async () => {
    const { session } = await newCoach();
    const made = (await create(session, 'Old name').expect(201)).body;

    const renamed = await harness
      .as(session)
      .put(`/named-forms/${made.id}`)
      .send({ name: 'New name' })
      .expect(200);

    expect(renamed.body).toMatchObject({
      name: 'New name',
      version: 'custom_v1',
    });
  });

  it('refuses a form with no questions or a missing name', async () => {
    const { session } = await newCoach();

    const noQuestions = await create(session, 'Empty', []).expect(422);
    const noName = await create(session, '   ').expect(400);

    expect(noQuestions.body.code).toBe('INVALID_FORM');
    expect(noName.body.code).toBe('VALIDATION_FAILED');
  });

  it('archives a form: it leaves the list but still opens', async () => {
    const { session } = await newCoach();
    const made = (await create(session, 'Temporary').expect(201)).body;

    await harness.as(session).delete(`/named-forms/${made.id}`).expect(204);

    expect((await list(session)).body).toEqual([]);
    await harness.as(session).get(`/named-forms/${made.id}`).expect(200);
  });

  it('does not exist for a form that is not there or not theirs', async () => {
    const mine = await newCoach();
    const theirs = await newCoach('Other Gym');
    const theirForm = (await create(theirs.session, 'Theirs').expect(201)).body;

    await Promise.all(
      [randomUUID(), theirForm.id].map(async (id) => {
        const response = await harness
          .as(mine.session)
          .get(`/named-forms/${id}`)
          .expect(404);
        expect(response.body.code).toBe('FORM_NOT_FOUND');
      }),
    );
    expect((await list(mine.session)).body).toEqual([]);
  });

  it('needs a token', async () => {
    await harness.server().get('/api/v1/named-forms').expect(401);
  });

  describe('an intake link that pins a form', () => {
    const makeLink = (session: TestSession, clientId: string, body?: object) =>
      harness
        .as(session)
        .post(`/clients/${clientId}/intake-link`)
        .send(body ?? {});

    it('shows the client the pinned form, not the default one', async () => {
      const { session } = await newCoach();
      const client = await addClient(session);
      const form = (
        await create(session, 'Muscle gain', questions('سؤال مخصص')).expect(201)
      ).body;

      const link = (
        await makeLink(session, client.id, { namedFormId: form.id }).expect(201)
      ).body;
      const opened = await harness
        .server()
        .get(`/api/v1/intake/${link.token}`)
        .expect(200);

      expect(link.namedFormId).toBe(form.id);
      expect(opened.body.form.templateId).toEqual(expect.any(String));
      expect(opened.body.form.questions).toHaveLength(2);
      expect(opened.body.form.questions[0].labelAr).toBe('سؤال مخصص');
    });

    it('changes what an open link asks, keeping the same address', async () => {
      const { session } = await newCoach();
      const client = await addClient(session);
      const first = (await create(session, 'First').expect(201)).body;
      const second = (
        await create(session, 'Second', questions('الثاني')).expect(201)
      ).body;
      const link = (
        await makeLink(session, client.id, { namedFormId: first.id }).expect(
          201,
        )
      ).body;

      const again = (
        await makeLink(session, client.id, { namedFormId: second.id }).expect(
          201,
        )
      ).body;
      const kept = (await makeLink(session, client.id).expect(201)).body;
      const back = (
        await makeLink(session, client.id, { namedFormId: null }).expect(201)
      ).body;

      expect(again.token).toBe(link.token);
      expect(again.namedFormId).toBe(second.id);
      expect(kept.namedFormId).toBe(second.id);
      expect(back.namedFormId).toBeNull();
    });

    it('refuses a form that is not the coach’s', async () => {
      const mine = await newCoach();
      const theirs = await newCoach('Other Gym');
      const client = await addClient(mine.session);
      const theirForm = (await create(theirs.session, 'Theirs').expect(201))
        .body;

      const response = await makeLink(mine.session, client.id, {
        namedFormId: theirForm.id,
      }).expect(404);

      expect(response.body.code).toBe('FORM_NOT_FOUND');
    });
  });
});
