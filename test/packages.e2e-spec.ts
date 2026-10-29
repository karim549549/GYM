import { randomUUID } from 'node:crypto';
import { HttpTestApp, type TestSession } from './support/http-test-app';

describe('Packages over HTTP', () => {
  let harness: HttpTestApp;

  beforeAll(async () => {
    harness = await HttpTestApp.start();
  });

  afterAll(() => harness.stop(), 60_000);

  const newCoach = async (brandName = 'Packages Gym') => {
    const { session } = await harness.signedUpPerson();
    const created = await harness
      .as(session)
      .post('/workspaces')
      .send({ brandName })
      .expect(201);
    harness.trackWorkspace(created.body.id);
    return { session, workspaceId: created.body.id as string };
  };

  const list = (session: TestSession, query = '') =>
    harness.as(session).get(`/packages${query}`);

  const create = (session: TestSession, body: Record<string, unknown>) =>
    harness.as(session).post('/packages').send(body);

  const quarterly = {
    name: 'Quarterly',
    durationDays: 90,
    priceMinor: 450_000,
  };

  describe('the packages a new coach starts with', () => {
    it('are one, three and six months, named in Arabic, with the price left to set', async () => {
      const { session } = await newCoach();

      const response = await list(session).expect(200);

      expect(response.body).toEqual([
        {
          id: expect.any(String),
          name: expect.stringMatching(/[؀-ۿ]/),
          durationDays: 30,
          priceMinor: 0,
          currency: 'EGP',
          isActive: true,
        },
        expect.objectContaining({ durationDays: 90, priceMinor: 0 }),
        expect.objectContaining({ durationDays: 180, priceMinor: 0 }),
      ]);
    });

    it('belong to that coach alone', async () => {
      const first = await newCoach();
      const second = await newCoach();
      const firstIds = (await list(first.session)).body.map(
        (p: { id: string }) => p.id,
      );

      const secondIds = (await list(second.session)).body.map(
        (p: { id: string }) => p.id,
      );

      expect(secondIds).toHaveLength(3);
      expect(secondIds.filter((id: string) => firstIds.includes(id))).toEqual(
        [],
      );
    });
  });

  describe('GET /packages', () => {
    it('lists the shortest first', async () => {
      const { session } = await newCoach();
      await create(session, {
        name: 'Two weeks',
        durationDays: 14,
        priceMinor: 100_000,
      }).expect(201);

      const days = (await list(session)).body.map(
        (p: { durationDays: number }) => p.durationDays,
      );

      expect(days).toEqual([14, 30, 90, 180]);
    });

    it('leaves out packages that are no longer sold, unless asked', async () => {
      const { session } = await newCoach();
      const made = await create(session, quarterly).expect(201);
      await harness
        .as(session)
        .patch(`/packages/${made.body.id}`)
        .send({ isActive: false })
        .expect(200);

      const active = (await list(session)).body.map(
        (p: { id: string }) => p.id,
      );
      const all = (await list(session, '?includeInactive=true')).body.map(
        (p: { id: string }) => p.id,
      );

      expect(active).not.toContain(made.body.id);
      expect(all).toContain(made.body.id);
    });

    it('refuses a filter it does not understand', async () => {
      const { session } = await newCoach();

      const response = await list(session, '?includeInactive=maybe').expect(
        400,
      );

      expect(response.body.code).toBe('VALIDATION_FAILED');
    });

    it('tells a person with no workspace to create one first', async () => {
      const { session } = await harness.signedUpPerson();

      const response = await list(session).expect(403);

      expect(response.body.code).toBe('NO_WORKSPACE');
    });

    it('needs a token', async () => {
      await harness.server().get('/api/v1/packages').expect(401);
    });
  });

  describe('POST /packages', () => {
    it('adds a package and returns it', async () => {
      const { session } = await newCoach();

      const response = await create(session, quarterly).expect(201);

      expect(response.body).toEqual({
        id: expect.any(String),
        name: 'Quarterly',
        durationDays: 90,
        priceMinor: 450_000,
        currency: 'EGP',
        isActive: true,
      });
      expect(
        (await list(session)).body.map((p: { id: string }) => p.id),
      ).toContain(response.body.id);
    });

    it('prices it in the workspace’s currency', async () => {
      const { session } = await newCoach();
      await harness
        .as(session)
        .patch('/workspaces/current')
        .send({ currency: 'USD' })
        .expect(200);

      const response = await create(session, quarterly).expect(201);

      expect(response.body.currency).toBe('USD');
    });

    it('trims the name', async () => {
      const { session } = await newCoach();

      const response = await create(session, {
        ...quarterly,
        name: '  Padded  ',
      }).expect(201);

      expect(response.body.name).toBe('Padded');
    });

    it('allows a free package', async () => {
      const { session } = await newCoach();

      const response = await create(session, {
        name: 'Trial',
        durationDays: 7,
        priceMinor: 0,
      }).expect(201);

      expect(response.body.priceMinor).toBe(0);
    });

    it.each([
      ['no name', { durationDays: 30, priceMinor: 100 }],
      ['a blank name', { ...quarterly, name: '   ' }],
      ['a name that is too long', { ...quarterly, name: 'x'.repeat(81) }],
      ['no duration', { name: 'A', priceMinor: 100 }],
      ['a duration of zero', { ...quarterly, durationDays: 0 }],
      ['a negative duration', { ...quarterly, durationDays: -5 }],
      ['a duration beyond ten years', { ...quarterly, durationDays: 3651 }],
      ['a duration with a fraction', { ...quarterly, durationDays: 1.5 }],
      ['a duration as text', { ...quarterly, durationDays: '30' }],
      ['no price', { name: 'A', durationDays: 30 }],
      ['a negative price', { ...quarterly, priceMinor: -1 }],
      [
        'a price with a fraction of a piastre',
        { ...quarterly, priceMinor: 1.5 },
      ],
      ['a price as text', { ...quarterly, priceMinor: '100' }],
      [
        'a price beyond a million pounds',
        { ...quarterly, priceMinor: 100_000_001 },
      ],
      ['a currency', { ...quarterly, currency: 'USD' }],
      ['a flag saying it is inactive', { ...quarterly, isActive: false }],
      ['another workspace', { ...quarterly, workspaceId: randomUUID() }],
    ])('refuses %s', async (_label, body) => {
      const { session } = await newCoach();

      const response = await create(session, body).expect(400);

      expect(response.body.code).toBe('VALIDATION_FAILED');
    });

    it('tells a person with no workspace to create one first', async () => {
      const { session } = await harness.signedUpPerson();

      const response = await create(session, quarterly).expect(403);

      expect(response.body.code).toBe('NO_WORKSPACE');
    });
  });

  describe('PATCH /packages/:id', () => {
    it('changes what was sent and nothing else', async () => {
      const { session } = await newCoach();
      const made = (await create(session, quarterly).expect(201)).body;

      const response = await harness
        .as(session)
        .patch(`/packages/${made.id}`)
        .send({ priceMinor: 500_000 })
        .expect(200);

      expect(response.body).toEqual({ ...made, priceMinor: 500_000 });
    });

    it('can change the name and the length too', async () => {
      const { session } = await newCoach();
      const made = (await create(session, quarterly).expect(201)).body;

      const response = await harness
        .as(session)
        .patch(`/packages/${made.id}`)
        .send({ name: '  Ninety days  ', durationDays: 91 })
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'Ninety days',
        durationDays: 91,
      });
    });

    it('deactivates and reactivates a package instead of deleting it', async () => {
      const { session } = await newCoach();
      const made = (await create(session, quarterly).expect(201)).body;

      const off = await harness
        .as(session)
        .patch(`/packages/${made.id}`)
        .send({ isActive: false })
        .expect(200);
      const on = await harness
        .as(session)
        .patch(`/packages/${made.id}`)
        .send({ isActive: true })
        .expect(200);

      expect(off.body.isActive).toBe(false);
      expect(on.body.isActive).toBe(true);
    });

    it('changes nothing when nothing is sent', async () => {
      const { session } = await newCoach();
      const made = (await create(session, quarterly).expect(201)).body;

      const response = await harness
        .as(session)
        .patch(`/packages/${made.id}`)
        .send({})
        .expect(200);

      expect(response.body).toEqual(made);
    });

    it('does not exist for a package that is not there', async () => {
      const { session } = await newCoach();

      const response = await harness
        .as(session)
        .patch(`/packages/${randomUUID()}`)
        .send({ name: 'Ghost' })
        .expect(404);

      expect(response.body.code).toBe('PACKAGE_NOT_FOUND');
    });

    it('cannot reach another coach’s package, which looks like it is not there', async () => {
      const mine = await newCoach();
      const theirs = await newCoach();
      const theirPackage = (await list(theirs.session)).body[0];

      const response = await harness
        .as(mine.session)
        .patch(`/packages/${theirPackage.id}`)
        .send({ priceMinor: 1, isActive: false })
        .expect(404);

      expect(response.body.code).toBe('PACKAGE_NOT_FOUND');
      const unchanged = (await list(theirs.session)).body[0];
      expect(unchanged).toEqual(theirPackage);
    });

    it('refuses an id that is not an id', async () => {
      const { session } = await newCoach();

      const response = await harness
        .as(session)
        .patch('/packages/not-an-id')
        .send({ name: 'x' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_FAILED');
    });

    it.each([
      ['a blank name', { name: '   ' }],
      ['a duration of zero', { durationDays: 0 }],
      ['a negative price', { priceMinor: -5 }],
      ['an active flag that is not true or false', { isActive: 'yes' }],
      ['a currency', { currency: 'USD' }],
      ['an id', { id: randomUUID() }],
      ['another workspace', { workspaceId: randomUUID() }],
    ])('refuses %s', async (_label, body) => {
      const { session } = await newCoach();
      const made = (await create(session, quarterly).expect(201)).body;

      const response = await harness
        .as(session)
        .patch(`/packages/${made.id}`)
        .send(body)
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_FAILED');
    });

    it('has no delete: a package is deactivated, never removed', async () => {
      const { session } = await newCoach();
      const made = (await create(session, quarterly).expect(201)).body;

      await harness.as(session).delete(`/packages/${made.id}`).expect(404);

      expect(
        (await list(session, '?includeInactive=true')).body.map(
          (p: { id: string }) => p.id,
        ),
      ).toContain(made.id);
    });
  });
});
