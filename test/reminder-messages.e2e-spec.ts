import { HttpTestApp, type TestSession } from './support/http-test-app';

describe('Reminder messages over HTTP', () => {
  let harness: HttpTestApp;

  beforeAll(async () => {
    harness = await HttpTestApp.start();
  });

  afterAll(() => harness.stop(), 60_000);

  const newCoach = async (brandName = 'Messages Gym') => {
    const { session } = await harness.signedUpPerson();
    const created = await harness
      .as(session)
      .post('/workspaces')
      .send({ brandName })
      .expect(201);
    harness.trackWorkspace(created.body.id);
    return { session };
  };

  const list = (session: TestSession) =>
    harness.as(session).get('/reminder-messages');

  const save = (session: TestSession, kind: string, body: unknown) =>
    harness.as(session).put(`/reminder-messages/${kind}`).send({ body });

  it('starts with none written', async () => {
    const { session } = await newCoach();

    expect((await list(session).expect(200)).body).toEqual([]);
  });

  it('keeps what the coach wrote, and writing again replaces it', async () => {
    const { session } = await newCoach();
    await save(session, 'expiring', 'Hi {name}, {days} days left').expect(200);
    await save(session, 'expiring', 'Hello {name}').expect(200);
    await save(session, 'payment_due', 'You owe {amount}').expect(200);

    const body = (await list(session).expect(200)).body as {
      kind: string;
      body: string;
    }[];

    expect(body).toHaveLength(2);
    expect(body).toEqual(
      expect.arrayContaining([
        { kind: 'expiring', body: 'Hello {name}' },
        { kind: 'payment_due', body: 'You owe {amount}' },
      ]),
    );
  });

  it.each([
    ['an unknown kind', 'weekly', 'Hello'],
    ['an empty message', 'expired', '   '],
    ['a message over 500 characters', 'expired', 'x'.repeat(501)],
  ])('refuses %s', async (_name, kind, text) => {
    const { session } = await newCoach();

    const response = await save(session, kind, text).expect(400);

    expect(response.body.code).toBe('VALIDATION_FAILED');
  });

  it('keeps each coach\'s wording to themselves', async () => {
    const first = await newCoach();
    const second = await newCoach('Other Gym');
    await save(first.session, 'expired', 'Mine').expect(200);

    expect((await list(second.session)).body).toEqual([]);
  });

  it('needs a token', async () => {
    await harness.server().get('/api/v1/reminder-messages').expect(401);
  });
});
