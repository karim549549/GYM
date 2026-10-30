import { randomUUID } from 'node:crypto';
import { HttpTestApp, type TestSession } from './support/http-test-app';

describe('Payment channels over HTTP', () => {
  let harness: HttpTestApp;

  beforeAll(async () => {
    harness = await HttpTestApp.start();
  });

  afterAll(() => harness.stop(), 60_000);

  const newCoach = async (brandName = 'Channels Gym') => {
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
    harness.as(session).get('/payment-channels');

  const create = (session: TestSession, body: Record<string, unknown>) =>
    harness.as(session).post('/payment-channels').send(body);

  const instapay = { method: 'instapay', account: 'coach.ahmed@instapay' };

  it('starts empty', async () => {
    const { session } = await newCoach();

    expect((await list(session).expect(200)).body).toEqual([]);
  });

  it('adds a payment method and lists it in the order added', async () => {
    const { session } = await newCoach();
    const first = await create(session, {
      ...instapay,
      url: 'https://instapay.eg',
    }).expect(201);
    await create(session, { method: 'wallet', account: '01012345678' }).expect(
      201,
    );

    const body = (await list(session).expect(200)).body;

    expect(first.body).toEqual({
      id: expect.any(String),
      method: 'instapay',
      account: 'coach.ahmed@instapay',
      url: 'https://instapay.eg',
    });
    expect(body.map((c: { method: string }) => c.method)).toEqual([
      'instapay',
      'wallet',
    ]);
    expect(body[1].url).toBeNull();
  });

  it.each([
    ['an unknown method', { method: 'card', account: '4111' }],
    ['no account', { method: 'bank', account: '  ' }],
    [
      'a link that is not https',
      { method: 'instapay', account: 'a@instapay', url: 'http://x.eg' },
    ],
  ])('refuses %s', async (_name, body) => {
    const { session } = await newCoach();

    const response = await create(session, body).expect(400);

    expect(response.body.code).toBe('VALIDATION_FAILED');
  });

  it('changes what was sent and clears the link with null', async () => {
    const { session } = await newCoach();
    const made = (
      await create(session, { ...instapay, url: 'https://instapay.eg' }).expect(
        201,
      )
    ).body;

    const renamed = await harness
      .as(session)
      .patch(`/payment-channels/${made.id}`)
      .send({ account: '01099999999' })
      .expect(200);
    const cleared = await harness
      .as(session)
      .patch(`/payment-channels/${made.id}`)
      .send({ url: null })
      .expect(200);

    expect(renamed.body).toMatchObject({
      account: '01099999999',
      url: 'https://instapay.eg',
    });
    expect(cleared.body.url).toBeNull();
  });

  it('removes a payment method', async () => {
    const { session } = await newCoach();
    const made = (await create(session, instapay).expect(201)).body;

    await harness
      .as(session)
      .delete(`/payment-channels/${made.id}`)
      .expect(204);

    expect((await list(session)).body).toEqual([]);
  });

  it('is not found for one that does not exist', async () => {
    const { session } = await newCoach();

    const response = await harness
      .as(session)
      .delete(`/payment-channels/${randomUUID()}`)
      .expect(404);

    expect(response.body.code).toBe('PAYMENT_CHANNEL_NOT_FOUND');
  });

  it("never shows or touches another coach's payment methods", async () => {
    const mine = await newCoach();
    const theirs = await newCoach('Other Gym');
    const theirChannel = (await create(theirs.session, instapay).expect(201))
      .body;

    expect((await list(mine.session)).body).toEqual([]);
    await harness
      .as(mine.session)
      .patch(`/payment-channels/${theirChannel.id}`)
      .send({ account: 'taken' })
      .expect(404);
    await harness
      .as(mine.session)
      .delete(`/payment-channels/${theirChannel.id}`)
      .expect(404);
  });

  it('needs a token', async () => {
    await harness.server().get('/api/v1/payment-channels').expect(401);
  });
});
