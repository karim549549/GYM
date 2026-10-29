import { randomUUID } from 'node:crypto';
import { HttpTestApp, type TestSession } from './support/http-test-app';

jest.setTimeout(30_000);

describe('Subscriptions and payments over HTTP', () => {
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
      .send({ brandName: 'Billing Gym' })
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

  const addPackage = async (
    session: TestSession,
    body: Record<string, unknown> = {},
  ) =>
    (
      await harness
        .as(session)
        .post('/packages')
        .send({
          name: 'Monthly',
          durationDays: 30,
          priceMinor: 150_000,
          ...body,
        })
        .expect(201)
    ).body as { id: string };

  const sell = (
    session: TestSession,
    clientId: string,
    body: Record<string, unknown>,
  ) =>
    harness.as(session).post(`/clients/${clientId}/subscriptions`).send(body);

  /** A coach with one client and one 30 day package at EGP 1,500.00. */
  const ready = async () => {
    const coach = await newCoach();
    const client = await addClient(coach.session);
    const pkg = await addPackage(coach.session);
    return { ...coach, client, pkg };
  };

  const sold = async (
    session: TestSession,
    clientId: string,
    body: Record<string, unknown>,
  ) => (await sell(session, clientId, body).expect(201)).body;

  const pay = (
    session: TestSession,
    subscriptionId: string,
    body: Record<string, unknown>,
  ) =>
    harness
      .as(session)
      .post(`/subscriptions/${subscriptionId}/payments`)
      .send(body);

  const find = (session: TestSession, subscriptionId: string) =>
    harness.as(session).get(`/subscriptions/${subscriptionId}`);

  const cairoToday = () =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

  const daysFromToday = (days: number) => {
    const moved = new Date(Date.parse(`${cairoToday()}T00:00:00Z`));
    moved.setUTCDate(moved.getUTCDate() + days);
    return moved.toISOString().slice(0, 10);
  };

  describe('POST /clients/:id/subscriptions', () => {
    it('sells a package from today, copying its name and price', async () => {
      const { session, client, pkg } = await ready();

      const response = await sell(session, client.id, {
        packageId: pkg.id,
      }).expect(201);

      expect(response.body).toEqual({
        id: expect.any(String),
        clientId: client.id,
        packageId: pkg.id,
        packageName: 'Monthly',
        priceMinor: 150_000,
        currency: 'EGP',
        startsOn: cairoToday(),
        endsOn: daysFromToday(29),
        status: 'active',
        state: 'payment_overdue',
        paidMinor: 0,
        dueMinor: 150_000,
        paymentStatus: 'unpaid',
        createdAt: expect.any(String),
      });
    });

    it('starts on the date given and ends when the package length is up', async () => {
      const { session, client, pkg } = await ready();

      const response = await sell(session, client.id, {
        packageId: pkg.id,
        startsOn: daysFromToday(10),
      }).expect(201);

      expect(response.body).toMatchObject({
        startsOn: daysFromToday(10),
        endsOn: daysFromToday(39),
      });
    });

    it('takes the price the coach agreed with the client instead of the list price', async () => {
      const { session, client, pkg } = await ready();

      const response = await sell(session, client.id, {
        packageId: pkg.id,
        priceMinor: 120_000,
      }).expect(201);

      expect(response.body).toMatchObject({
        priceMinor: 120_000,
        dueMinor: 120_000,
      });
    });

    it('does not change what was charged when the package price changes later', async () => {
      const { session, client, pkg } = await ready();
      const subscription = await sold(session, client.id, {
        packageId: pkg.id,
      });

      await harness
        .as(session)
        .patch(`/packages/${pkg.id}`)
        .send({ name: 'Monthly Plus', priceMinor: 180_000 })
        .expect(200);

      const response = await find(session, subscription.id).expect(200);
      expect(response.body).toMatchObject({
        packageName: 'Monthly',
        priceMinor: 150_000,
      });
    });

    it('is not expiring soon when the term is longer than the alert window', async () => {
      const { session, client, pkg } = await ready();
      await pay(
        session,
        (await sold(session, client.id, { packageId: pkg.id })).id,
        { amountMinor: 150_000, method: 'cash' },
      ).expect(201);

      const list = await harness
        .as(session)
        .get(`/clients/${client.id}/subscriptions`)
        .expect(200);

      expect(list.body.items[0]).toMatchObject({
        state: 'active',
        paymentStatus: 'paid',
      });
    });

    it('is expiring soon when what is left is inside the alert window', async () => {
      const { session, client } = await ready();
      const week = await addPackage(session, {
        name: 'One week',
        durationDays: 7,
        priceMinor: 0,
      });

      const response = await sell(session, client.id, {
        packageId: week.id,
      }).expect(201);

      expect(response.body).toMatchObject({
        state: 'expiring_soon',
        paymentStatus: 'paid',
        dueMinor: 0,
      });
    });

    it('refuses a package that does not exist', async () => {
      const { session, client } = await ready();

      const response = await sell(session, client.id, {
        packageId: randomUUID(),
      }).expect(404);

      expect(response.body.code).toBe('PACKAGE_NOT_FOUND');
    });

    it('refuses a package that is no longer sold', async () => {
      const { session, client, pkg } = await ready();
      await harness
        .as(session)
        .patch(`/packages/${pkg.id}`)
        .send({ isActive: false })
        .expect(200);

      const response = await sell(session, client.id, {
        packageId: pkg.id,
      }).expect(422);

      expect(response.body.code).toBe('PACKAGE_NOT_SOLD');
    });

    it('refuses a client that does not exist', async () => {
      const { session, pkg } = await ready();

      const response = await sell(session, randomUUID(), {
        packageId: pkg.id,
      }).expect(404);

      expect(response.body.code).toBe('CLIENT_NOT_FOUND');
    });

    it('refuses a client who was removed', async () => {
      const { session, client, pkg } = await ready();
      await harness.as(session).delete(`/clients/${client.id}`).expect(204);

      await sell(session, client.id, { packageId: pkg.id }).expect(404);
    });

    it('does not reach another coach’s client or package', async () => {
      const mine = await ready();
      const theirs = await ready();

      const otherClient = await sell(mine.session, theirs.client.id, {
        packageId: mine.pkg.id,
      }).expect(404);
      const otherPackage = await sell(mine.session, mine.client.id, {
        packageId: theirs.pkg.id,
      }).expect(404);

      expect(otherClient.body.code).toBe('CLIENT_NOT_FOUND');
      expect(otherPackage.body.code).toBe('PACKAGE_NOT_FOUND');
    });

    it.each([
      ['no package', {}],
      ['a package that is not an id', { packageId: 'monthly' }],
      ['a start date that is not a date', { startsOn: 'tomorrow' }],
      ['a negative price', { priceMinor: -1 }],
      ['a price with fractions', { priceMinor: 10.5 }],
    ])('refuses %s', async (_label, extra) => {
      const { session, client, pkg } = await ready();
      const body = { packageId: pkg.id, ...extra };
      if (_label === 'no package') {
        delete (body as Record<string, unknown>).packageId;
      }

      await sell(session, client.id, body).expect(400);
    });

    it('refuses a second live subscription for the same client', async () => {
      const { session, client, pkg } = await ready();
      await sold(session, client.id, { packageId: pkg.id });

      const response = await sell(session, client.id, {
        packageId: pkg.id,
      }).expect(409);

      expect(response.body.code).toBe('CLIENT_HAS_ACTIVE_SUBSCRIPTION');
    });

    it('lets exactly one of two simultaneous sales through', async () => {
      const { session, client, pkg } = await ready();

      const results = await Promise.all([
        sell(session, client.id, { packageId: pkg.id }),
        sell(session, client.id, { packageId: pkg.id }),
      ]);

      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        201, 409,
      ]);
      expect(results.find((r) => r.status === 409)?.body.code).toBe(
        'CLIENT_HAS_ACTIVE_SUBSCRIPTION',
      );
    });

    it('closes a subscription whose term is over when the client buys again', async () => {
      const { session, client, pkg } = await ready();
      const old = await sold(session, client.id, {
        packageId: pkg.id,
        startsOn: daysFromToday(-60),
      });

      await sell(session, client.id, { packageId: pkg.id }).expect(201);

      const closed = await find(session, old.id).expect(200);
      expect(closed.body).toMatchObject({ status: 'ended', state: 'ended' });
    });

    it('allows a new sale after the old one was cancelled', async () => {
      const { session, client, pkg } = await ready();
      const first = await sold(session, client.id, { packageId: pkg.id });
      await harness
        .as(session)
        .post(`/subscriptions/${first.id}/cancel`)
        .expect(201);

      await sell(session, client.id, { packageId: pkg.id }).expect(201);
    });
  });

  describe('listing and reading', () => {
    it('lists a client’s subscriptions, newest start first, in pages', async () => {
      const { session, client, pkg } = await ready();
      const first = await sold(session, client.id, {
        packageId: pkg.id,
        startsOn: daysFromToday(-90),
      });
      const second = await sold(session, client.id, { packageId: pkg.id });

      const response = await harness
        .as(session)
        .get(`/clients/${client.id}/subscriptions?limit=1`)
        .expect(200);

      expect(response.body).toMatchObject({
        total: 2,
        limit: 1,
        hasNext: true,
      });
      expect(response.body.items.map((s: { id: string }) => s.id)).toEqual([
        second.id,
      ]);
      expect(first.id).not.toBe(second.id);
    });

    it('lists the workspace’s subscriptions and filters by stored status', async () => {
      const { session, client, pkg } = await ready();
      const other = await addClient(session);
      const live = await sold(session, client.id, { packageId: pkg.id });
      const cancelled = await sold(session, other.id, { packageId: pkg.id });
      await harness
        .as(session)
        .post(`/subscriptions/${cancelled.id}/cancel`)
        .expect(201);

      const all = await harness.as(session).get('/subscriptions').expect(200);
      const onlyCancelled = await harness
        .as(session)
        .get('/subscriptions?status=cancelled')
        .expect(200);
      const onlyOneClient = await harness
        .as(session)
        .get(`/subscriptions?clientId=${client.id}`)
        .expect(200);

      expect(all.body.total).toBe(2);
      expect(onlyCancelled.body.items.map((s: { id: string }) => s.id)).toEqual(
        [cancelled.id],
      );
      expect(onlyOneClient.body.items.map((s: { id: string }) => s.id)).toEqual(
        [live.id],
      );
    });

    it('lists only live subscriptions that end within a number of days', async () => {
      const { session, client, pkg } = await ready();
      const other = await addClient(session);
      const soon = await sold(session, client.id, {
        packageId: pkg.id,
        startsOn: daysFromToday(-25),
      });
      await sold(session, other.id, { packageId: pkg.id });

      const response = await harness
        .as(session)
        .get('/subscriptions?endsWithinDays=7')
        .expect(200);

      expect(response.body.items.map((s: { id: string }) => s.id)).toEqual([
        soon.id,
      ]);
    });

    it('refuses a bad id, and a subscription that is not there', async () => {
      const { session } = await ready();

      await find(session, 'nope').expect(400);
      const missing = await find(session, randomUUID()).expect(404);

      expect(missing.body.code).toBe('SUBSCRIPTION_NOT_FOUND');
    });

    it('does not show another coach’s subscriptions', async () => {
      const mine = await ready();
      const theirs = await ready();
      const subscription = await sold(theirs.session, theirs.client.id, {
        packageId: theirs.pkg.id,
      });

      await find(mine.session, subscription.id).expect(404);
      const list = await harness
        .as(mine.session)
        .get('/subscriptions')
        .expect(200);
      expect(list.body.total).toBe(0);
    });
  });

  describe('PATCH /subscriptions/:id', () => {
    it('moves the end date', async () => {
      const { session, client, pkg } = await ready();
      const subscription = await sold(session, client.id, {
        packageId: pkg.id,
      });

      const response = await harness
        .as(session)
        .patch(`/subscriptions/${subscription.id}`)
        .send({ endsOn: daysFromToday(60) })
        .expect(200);

      expect(response.body.endsOn).toBe(daysFromToday(60));
    });

    it('refuses an end date before the start', async () => {
      const { session, client, pkg } = await ready();
      const subscription = await sold(session, client.id, {
        packageId: pkg.id,
      });

      const response = await harness
        .as(session)
        .patch(`/subscriptions/${subscription.id}`)
        .send({ endsOn: daysFromToday(-1) })
        .expect(422);

      expect(response.body.code).toBe('END_BEFORE_START');
    });

    it('refuses to change a subscription that is over', async () => {
      const { session, client, pkg } = await ready();
      const subscription = await sold(session, client.id, {
        packageId: pkg.id,
      });
      await harness
        .as(session)
        .post(`/subscriptions/${subscription.id}/cancel`)
        .expect(201);

      const response = await harness
        .as(session)
        .patch(`/subscriptions/${subscription.id}`)
        .send({ endsOn: daysFromToday(60) })
        .expect(409);

      expect(response.body.code).toBe('SUBSCRIPTION_CLOSED');
    });

    it('refuses an empty change and a date that is not a date', async () => {
      const { session, client, pkg } = await ready();
      const subscription = await sold(session, client.id, {
        packageId: pkg.id,
      });
      const url = `/subscriptions/${subscription.id}`;

      await harness.as(session).patch(url).send({}).expect(400);
      await harness.as(session).patch(url).send({ endsOn: 'soon' }).expect(400);
    });
  });

  describe('freezing', () => {
    it('freezes, and gives the frozen days back on resume', async () => {
      const { session, client, pkg } = await ready();
      const subscription = await sold(session, client.id, {
        packageId: pkg.id,
      });
      const url = `/subscriptions/${subscription.id}`;

      const frozen = await harness
        .as(session)
        .post(`${url}/freeze`)
        .send({ reason: 'Travelling' })
        .expect(201);
      expect(frozen.body).toMatchObject({ status: 'frozen', state: 'frozen' });

      const resumed = await harness
        .as(session)
        .post(`${url}/resume`)
        .send({ resumedOn: daysFromToday(10) })
        .expect(201);
      expect(resumed.body).toMatchObject({
        status: 'active',
        endsOn: daysFromToday(39),
      });
    });

    it('freezes from an earlier day when the coach remembers late', async () => {
      const { session, client, pkg } = await ready();
      const subscription = await sold(session, client.id, {
        packageId: pkg.id,
      });
      const url = `/subscriptions/${subscription.id}`;

      await harness
        .as(session)
        .post(`${url}/freeze`)
        .send({ frozenOn: daysFromToday(-5) })
        .expect(201);
      const resumed = await harness
        .as(session)
        .post(`${url}/resume`)
        .expect(201);

      expect(resumed.body.endsOn).toBe(daysFromToday(34));
    });

    it('cannot be resumed before it was frozen', async () => {
      const { session, client, pkg } = await ready();
      const subscription = await sold(session, client.id, {
        packageId: pkg.id,
      });
      const url = `/subscriptions/${subscription.id}`;
      await harness.as(session).post(`${url}/freeze`).expect(201);

      const response = await harness
        .as(session)
        .post(`${url}/resume`)
        .send({ resumedOn: daysFromToday(-3) })
        .expect(422);

      expect(response.body.code).toBe('RESUME_BEFORE_FREEZE');
    });

    it('cannot be frozen twice, or resumed when not frozen', async () => {
      const { session, client, pkg } = await ready();
      const subscription = await sold(session, client.id, {
        packageId: pkg.id,
      });
      const url = `/subscriptions/${subscription.id}`;

      const notFrozen = await harness
        .as(session)
        .post(`${url}/resume`)
        .expect(409);
      await harness.as(session).post(`${url}/freeze`).expect(201);
      const twice = await harness.as(session).post(`${url}/freeze`).expect(409);

      expect(notFrozen.body.code).toBe('SUBSCRIPTION_NOT_FROZEN');
      expect(twice.body.code).toBe('SUBSCRIPTION_NOT_ACTIVE');
    });

    it('still counts as the client’s live subscription while frozen', async () => {
      const { session, client, pkg } = await ready();
      const subscription = await sold(session, client.id, {
        packageId: pkg.id,
      });
      await harness
        .as(session)
        .post(`/subscriptions/${subscription.id}/freeze`)
        .expect(201);

      await sell(session, client.id, { packageId: pkg.id }).expect(409);
    });

    it('keeps each pause, so the moved date can be explained', async () => {
      const { session, client, pkg } = await ready();
      const subscription = await sold(session, client.id, {
        packageId: pkg.id,
      });
      const url = `/subscriptions/${subscription.id}`;
      await harness
        .as(session)
        .post(`${url}/freeze`)
        .send({ reason: 'Exams' })
        .expect(201);
      await harness
        .as(session)
        .post(`${url}/resume`)
        .send({ resumedOn: daysFromToday(3) })
        .expect(201);

      const response = await harness
        .as(session)
        .get(`${url}/freezes`)
        .expect(200);

      expect(response.body.items).toEqual([
        {
          id: expect.any(String),
          frozenOn: cairoToday(),
          resumedOn: daysFromToday(3),
          reason: 'Exams',
        },
      ]);
    });
  });

  describe('POST /subscriptions/:id/cancel', () => {
    it('cancels once', async () => {
      const { session, client, pkg } = await ready();
      const subscription = await sold(session, client.id, {
        packageId: pkg.id,
      });
      const url = `/subscriptions/${subscription.id}/cancel`;

      const first = await harness.as(session).post(url).expect(201);
      const second = await harness.as(session).post(url).expect(409);

      expect(first.body).toMatchObject({
        status: 'cancelled',
        state: 'cancelled',
      });
      expect(second.body.code).toBe('SUBSCRIPTION_CLOSED');
    });
  });

  describe('payments', () => {
    it('records a part payment, then the rest, as two rows', async () => {
      const { session, client, pkg } = await ready();
      const subscription = await sold(session, client.id, {
        packageId: pkg.id,
      });

      const first = await pay(session, subscription.id, {
        amountMinor: 80_000,
        method: 'instapay',
        note: 'First half',
      }).expect(201);
      const afterFirst = await find(session, subscription.id).expect(200);
      await pay(session, subscription.id, {
        amountMinor: 70_000,
        method: 'cash',
      }).expect(201);
      const afterSecond = await find(session, subscription.id).expect(200);

      expect(first.body).toEqual({
        id: expect.any(String),
        subscriptionId: subscription.id,
        clientId: client.id,
        amountMinor: 80_000,
        currency: 'EGP',
        method: 'instapay',
        paidOn: cairoToday(),
        note: 'First half',
        receiptUrl: null,
        createdAt: expect.any(String),
      });
      expect(afterFirst.body).toMatchObject({
        paidMinor: 80_000,
        dueMinor: 70_000,
        paymentStatus: 'partial',
        state: 'payment_overdue',
      });
      expect(afterSecond.body).toMatchObject({
        paidMinor: 150_000,
        dueMinor: 0,
        paymentStatus: 'paid',
        state: 'active',
      });
    });

    it('takes the date the money was received', async () => {
      const { session, client, pkg } = await ready();
      const subscription = await sold(session, client.id, {
        packageId: pkg.id,
      });

      const response = await pay(session, subscription.id, {
        amountMinor: 10_000,
        method: 'wallet',
        paidOn: daysFromToday(-2),
      }).expect(201);

      expect(response.body.paidOn).toBe(daysFromToday(-2));
    });

    it('refuses more than is owed', async () => {
      const { session, client, pkg } = await ready();
      const subscription = await sold(session, client.id, {
        packageId: pkg.id,
      });
      await pay(session, subscription.id, {
        amountMinor: 100_000,
        method: 'cash',
      }).expect(201);

      const response = await pay(session, subscription.id, {
        amountMinor: 50_001,
        method: 'cash',
      }).expect(422);

      expect(response.body.code).toBe('PAYMENT_EXCEEDS_DUE');
    });

    it('lets only one of two payments that together exceed the price through', async () => {
      const { session, client, pkg } = await ready();
      const subscription = await sold(session, client.id, {
        packageId: pkg.id,
      });

      const results = await Promise.all([
        pay(session, subscription.id, { amountMinor: 100_000, method: 'cash' }),
        pay(session, subscription.id, { amountMinor: 100_000, method: 'cash' }),
      ]);

      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        201, 422,
      ]);
    });

    it('accepts a payment on a subscription that has expired, for a late payer', async () => {
      const { session, client, pkg } = await ready();
      const subscription = await sold(session, client.id, {
        packageId: pkg.id,
        startsOn: daysFromToday(-60),
      });

      await pay(session, subscription.id, {
        amountMinor: 150_000,
        method: 'bank',
      }).expect(201);
    });

    it('refuses a payment on a cancelled subscription', async () => {
      const { session, client, pkg } = await ready();
      const subscription = await sold(session, client.id, {
        packageId: pkg.id,
      });
      await harness
        .as(session)
        .post(`/subscriptions/${subscription.id}/cancel`)
        .expect(201);

      const response = await pay(session, subscription.id, {
        amountMinor: 10_000,
        method: 'cash',
      }).expect(409);

      expect(response.body.code).toBe('SUBSCRIPTION_CLOSED');
    });

    it.each([
      ['a zero amount', { amountMinor: 0, method: 'cash' }],
      ['a negative amount', { amountMinor: -5, method: 'cash' }],
      ['an amount with fractions', { amountMinor: 10.5, method: 'cash' }],
      ['no amount', { method: 'cash' }],
      ['a method nobody offers', { amountMinor: 100, method: 'bitcoin' }],
      ['no method', { amountMinor: 100 }],
      [
        'a date that is not a date',
        { amountMinor: 100, method: 'cash', paidOn: 'x' },
      ],
      [
        'a note over 500 characters',
        { amountMinor: 100, method: 'cash', note: 'x'.repeat(501) },
      ],
    ])('refuses %s', async (_label, body) => {
      const { session, client, pkg } = await ready();
      const subscription = await sold(session, client.id, {
        packageId: pkg.id,
      });

      await pay(session, subscription.id, body).expect(400);
    });

    it('does not reach another coach’s subscription', async () => {
      const mine = await ready();
      const theirs = await ready();
      const subscription = await sold(theirs.session, theirs.client.id, {
        packageId: theirs.pkg.id,
      });

      const response = await pay(mine.session, subscription.id, {
        amountMinor: 100,
        method: 'cash',
      }).expect(404);

      expect(response.body.code).toBe('SUBSCRIPTION_NOT_FOUND');
    });

    describe('GET /payments', () => {
      it('lists payments newest first with the filters', async () => {
        const { session, client, pkg } = await ready();
        const other = await addClient(session);
        const one = await sold(session, client.id, { packageId: pkg.id });
        const two = await sold(session, other.id, { packageId: pkg.id });
        const old = await pay(session, one.id, {
          amountMinor: 10_000,
          method: 'cash',
          paidOn: daysFromToday(-20),
        }).expect(201);
        const recent = await pay(session, one.id, {
          amountMinor: 20_000,
          method: 'instapay',
          paidOn: daysFromToday(-1),
        }).expect(201);
        const elsewhere = await pay(session, two.id, {
          amountMinor: 30_000,
          method: 'cash',
        }).expect(201);
        const ids = (response: { body: { items: { id: string }[] } }) =>
          response.body.items.map((p) => p.id);

        const all = await harness.as(session).get('/payments').expect(200);
        const byClient = await harness
          .as(session)
          .get(`/payments?clientId=${client.id}`)
          .expect(200);
        const bySubscription = await harness
          .as(session)
          .get(`/payments?subscriptionId=${two.id}`)
          .expect(200);
        const byMethod = await harness
          .as(session)
          .get('/payments?method=instapay')
          .expect(200);
        const byDate = await harness
          .as(session)
          .get(`/payments?from=${daysFromToday(-5)}&to=${daysFromToday(0)}`)
          .expect(200);

        expect(ids(all)).toEqual([
          elsewhere.body.id,
          recent.body.id,
          old.body.id,
        ]);
        expect(ids(byClient)).toEqual([recent.body.id, old.body.id]);
        expect(ids(bySubscription)).toEqual([elsewhere.body.id]);
        expect(ids(byMethod)).toEqual([recent.body.id]);
        expect(ids(byDate)).toEqual([elsewhere.body.id, recent.body.id]);
      });

      it('shows only the coach’s own payments', async () => {
        const mine = await ready();
        const theirs = await ready();
        const subscription = await sold(theirs.session, theirs.client.id, {
          packageId: theirs.pkg.id,
        });
        await pay(theirs.session, subscription.id, {
          amountMinor: 100,
          method: 'cash',
        }).expect(201);

        const response = await harness
          .as(mine.session)
          .get('/payments')
          .expect(200);

        expect(response.body.total).toBe(0);
      });
    });

    describe('GET /payments/summary', () => {
      it('totals what was received between two dates, by method', async () => {
        const { session, client, pkg } = await ready();
        const subscription = await sold(session, client.id, {
          packageId: pkg.id,
        });
        await pay(session, subscription.id, {
          amountMinor: 50_000,
          method: 'cash',
        }).expect(201);
        await pay(session, subscription.id, {
          amountMinor: 30_000,
          method: 'instapay',
          paidOn: daysFromToday(-40),
        }).expect(201);

        const response = await harness
          .as(session)
          .get(
            `/payments/summary?from=${daysFromToday(-1)}&to=${daysFromToday(1)}`,
          )
          .expect(200);

        expect(response.body).toEqual({
          totalMinor: 50_000,
          count: 1,
          byMethod: { cash: 50_000 },
        });
      });

      it('is zero when nothing was received', async () => {
        const { session } = await ready();

        const response = await harness
          .as(session)
          .get(
            `/payments/summary?from=${daysFromToday(-1)}&to=${daysFromToday(1)}`,
          )
          .expect(200);

        expect(response.body).toEqual({
          totalMinor: 0,
          count: 0,
          byMethod: {},
        });
      });

      it('needs both dates', async () => {
        const { session } = await ready();

        await harness.as(session).get('/payments/summary').expect(400);
      });
    });
  });

  describe('GET /home', () => {
    it('gives the three numbers for the home screen', async () => {
      const { session, client, pkg } = await ready();
      const second = await addClient(session);
      const soon = await addClient(session);
      const live = await sold(session, client.id, { packageId: pkg.id });
      await sold(session, second.id, { packageId: pkg.id });
      await sold(session, soon.id, {
        packageId: pkg.id,
        startsOn: daysFromToday(-25),
      });
      await pay(session, live.id, {
        amountMinor: 70_000,
        method: 'cash',
      }).expect(201);

      const response = await harness.as(session).get('/home').expect(200);

      expect(response.body).toEqual({
        activeClients: 3,
        monthRevenueMinor: 70_000,
        renewalsDueThisWeek: 1,
      });
    });

    it('does not count cancelled or expired subscriptions as active clients', async () => {
      const { session, client, pkg } = await ready();
      const second = await addClient(session);
      await sold(session, client.id, {
        packageId: pkg.id,
        startsOn: daysFromToday(-60),
      });
      const cancelled = await sold(session, second.id, { packageId: pkg.id });
      await harness
        .as(session)
        .post(`/subscriptions/${cancelled.id}/cancel`)
        .expect(201);

      const response = await harness.as(session).get('/home').expect(200);

      expect(response.body).toEqual({
        activeClients: 0,
        monthRevenueMinor: 0,
        renewalsDueThisWeek: 0,
      });
    });
  });
});
