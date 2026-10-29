import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { checkins, measurements } from '../src/database/schema';
import { HttpTestApp, type TestSession } from './support/http-test-app';

jest.setTimeout(60_000);

describe('Analytics over HTTP', () => {
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
      .send({ brandName: 'Analytics Gym' })
      .expect(201);
    harness.trackWorkspace(created.body.id);
    workspaceOf.set(session.accessToken, created.body.id as string);
    return { session, workspaceId: created.body.id as string };
  };

  // the clients here have agreed, as they would have on the intake form, so the coach may read their data
  const workspaceOf = new Map<string, string>();
  const addClient = async (session: TestSession, fullName = 'Omar Khaled') => {
    const client = (
      await harness
        .as(session)
        .post('/clients')
        .send({ fullName, phone: harness.uniquePhone() })
        .expect(201)
    ).body as { id: string };
    await harness.grantClientConsents(
      workspaceOf.get(session.accessToken)!,
      client.id,
    );
    return client;
  };

  const cairoToday = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(
      new Date(),
    );
  const daysFromToday = (days: number) => {
    const moved = new Date(Date.parse(`${cairoToday()}T00:00:00Z`));
    moved.setUTCDate(moved.getUTCDate() + days);
    return moved.toISOString().slice(0, 10);
  };

  const progress = (session: TestSession, clientId: string) =>
    harness.as(session).get(`/clients/${clientId}/progress`);

  const record = (
    workspaceId: string,
    clientId: string,
    metric: string,
    unit: string,
    readings: [number, number][],
  ) =>
    harness.tx.run(
      () =>
        harness.tx.db.insert(measurements).values(
          readings.map(([daysAgo, value]) => ({
            workspaceId,
            clientId,
            metric,
            unit,
            value,
            measuredAt: daysFromToday(-daysAgo),
          })),
        ),
      { workspaceId },
    );

  describe('GET /clients/:id/progress', () => {
    it('has nothing to show for a client with no history', async () => {
      const { session } = await newCoach();
      const client = await addClient(session);

      const response = await progress(session, client.id).expect(200);

      expect(response.body).toEqual({
        weight: {
          unit: null,
          points: [],
          target: null,
          first: null,
          latest: null,
          change: null,
          weeklyRate: null,
        },
        measurements: [],
        adherence: {
          nutritionPct: null,
          trainingPct: null,
          checkinRatePct: null,
        },
        weeksCompleted: null,
        lastCheckinAt: null,
      });
    });

    it('draws the weight with its target, and what changed and how fast', async () => {
      const { session, workspaceId } = await newCoach();
      const client = await addClient(session);
      await record(workspaceId, client.id, 'weight', 'kg', [
        [28, 90],
        [14, 88],
        [0, 86],
      ]);
      await record(workspaceId, client.id, 'target_weight', 'kg', [[0, 80]]);

      const response = await progress(session, client.id).expect(200);

      expect(response.body.weight).toEqual({
        unit: 'kg',
        points: [
          { date: daysFromToday(-28), value: 90 },
          { date: daysFromToday(-14), value: 88 },
          { date: daysFromToday(0), value: 86 },
        ],
        target: 80,
        first: { date: daysFromToday(-28), value: 90 },
        latest: { date: daysFromToday(0), value: 86 },
        change: -4,
        weeklyRate: -1,
      });
    });

    it('draws every other measurement as a chart of its own, by name', async () => {
      const { session, workspaceId } = await newCoach();
      const client = await addClient(session);
      await record(workspaceId, client.id, 'waist', 'cm', [
        [14, 90],
        [0, 88],
      ]);
      await record(workspaceId, client.id, 'arm', 'cm', [[0, 36]]);
      await record(workspaceId, client.id, 'weight', 'kg', [[0, 80]]);

      const response = await progress(session, client.id).expect(200);

      expect(response.body.measurements).toEqual([
        {
          metric: 'arm',
          unit: 'cm',
          points: [{ date: daysFromToday(0), value: 36 }],
        },
        {
          metric: 'waist',
          unit: 'cm',
          points: [
            { date: daysFromToday(-14), value: 90 },
            { date: daysFromToday(0), value: 88 },
          ],
        },
      ]);
    });

    it('counts a check-in handed in: the numbers reach the chart and the adherence', async () => {
      const { session } = await newCoach();
      const client = await addClient(session);
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
      ).body.items as { dueOn: string; link: string }[];
      const today = items.find((i) => i.dueOn === daysFromToday(0))!;
      await harness
        .server()
        .post(`/api/v1/checkin/${today.link.split('/').pop()}`)
        .send({ answers: { weight: 82, nutritionDays: 6, trainingDays: 3 } })
        .expect(201);

      const response = await progress(session, client.id).expect(200);

      expect(response.body.weight.latest).toEqual({
        date: daysFromToday(0),
        value: 82,
      });
      expect(response.body.adherence).toEqual({
        nutritionPct: 85.7,
        trainingPct: 42.9,
        checkinRatePct: 100,
      });
      expect(response.body.lastCheckinAt).toEqual(expect.any(String));
    });

    it('counts a check-in not handed in against the rate', async () => {
      const { session, workspaceId } = await newCoach();
      const client = await addClient(session);
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
      const today = items.find((i) => i.dueOn === daysFromToday(0))!;
      const later = items.find((i) => i.dueOn === daysFromToday(1))!;
      await harness
        .server()
        .post(`/api/v1/checkin/${today.link.split('/').pop()}`)
        .send({ answers: { weight: 82, nutritionDays: 7, trainingDays: 7 } })
        .expect(201);
      await harness.tx.run(
        () =>
          harness.tx.db
            .update(checkins)
            .set({ dueOn: daysFromToday(-3) })
            .where(eq(checkins.id, later.id)),
        { workspaceId },
      );

      const response = await progress(session, client.id).expect(200);

      expect(response.body.adherence).toEqual({
        nutritionPct: 100,
        trainingPct: 100,
        checkinRatePct: 50,
      });
    });

    it('counts the weeks since the first subscription began', async () => {
      const { session } = await newCoach();
      const client = await addClient(session);
      const pkg = (
        await harness
          .as(session)
          .post('/packages')
          .send({ name: 'Monthly', durationDays: 30, priceMinor: 100_000 })
          .expect(201)
      ).body;
      await harness
        .as(session)
        .post(`/clients/${client.id}/subscriptions`)
        .send({ packageId: pkg.id, startsOn: daysFromToday(-15) })
        .expect(201);

      const response = await progress(session, client.id).expect(200);

      expect(response.body.weeksCompleted).toBe(2);
    });

    it('does not reach another coach’s client, and refuses an id that is not one', async () => {
      const mine = await newCoach();
      const theirs = await newCoach();
      const client = await addClient(theirs.session);

      const response = await progress(mine.session, client.id).expect(404);
      await progress(mine.session, 'nope').expect(400);
      await progress(mine.session, randomUUID()).expect(404);

      expect(response.body.code).toBe('CLIENT_NOT_FOUND');
    });
  });

  describe('GET /analytics/business', () => {
    const business = (session: TestSession) =>
      harness.as(session).get('/analytics/business');

    it('is zeros and nothing to average for a coach just starting', async () => {
      const { session } = await newCoach();

      const response = await business(session).expect(200);

      expect(response.body.revenue).toHaveLength(6);
      expect(
        response.body.revenue.every(
          (m: { totalMinor: number }) => m.totalMinor === 0,
        ),
      ).toBe(true);
      expect(response.body.activeClients).toHaveLength(6);
      expect(
        response.body.activeClients.every(
          (m: { activeClients: number }) => m.activeClients === 0,
        ),
      ).toBe(true);
      expect(response.body).toMatchObject({
        renewalRatePct: null,
        averageClientLifetimeDays: null,
        averageRevenuePerClientMinor: null,
        atRiskClients: 0,
      });
    });

    it('covers the last six months, oldest first, ending with this one', async () => {
      const { session } = await newCoach();

      const response = await business(session).expect(200);

      const months = response.body.revenue.map(
        (m: { month: string }) => m.month,
      );
      expect(months).toEqual(
        [...months].sort((a, b) => String(a).localeCompare(String(b))),
      );
      expect(months[5]).toBe(cairoToday().slice(0, 7));
      expect(
        response.body.activeClients.map((m: { month: string }) => m.month),
      ).toEqual(months);
    });

    it('adds up what was received each month', async () => {
      const { session } = await newCoach();
      const client = await addClient(session);
      const pkg = (
        await harness
          .as(session)
          .post('/packages')
          .send({ name: 'Monthly', durationDays: 30, priceMinor: 500_000 })
          .expect(201)
      ).body;
      const subscription = (
        await harness
          .as(session)
          .post(`/clients/${client.id}/subscriptions`)
          .send({ packageId: pkg.id })
          .expect(201)
      ).body;
      await (
        [
          [daysFromToday(0), 50_000],
          [daysFromToday(0), 20_000],
          [daysFromToday(-45), 30_000],
        ] as const
      ).reduce(async (previous, [paidOn, amountMinor]) => {
        await previous;

        await harness
          .as(session)
          .post(`/subscriptions/${subscription.id}/payments`)
          .send({ amountMinor, method: 'cash', paidOn })
          .expect(201);
      }, Promise.resolve());

      const response = await business(session).expect(200);

      const revenue = response.body.revenue as {
        month: string;
        totalMinor: number;
      }[];
      expect(revenue[5]).toEqual({
        month: cairoToday().slice(0, 7),
        totalMinor:
          revenue[5].month === daysFromToday(-45).slice(0, 7)
            ? 100_000
            : 70_000,
      });
      expect(revenue.reduce((sum, m) => sum + m.totalMinor, 0)).toBe(100_000);
      expect(response.body.averageRevenuePerClientMinor).toBe(100_000);
    });

    it('counts the clients a subscription covers, this month included', async () => {
      const { session } = await newCoach();
      const pkg = (
        await harness
          .as(session)
          .post('/packages')
          .send({ name: 'Monthly', durationDays: 30, priceMinor: 100_000 })
          .expect(201)
      ).body;
      await Array.from({ length: 2 }).reduce(async (previous) => {
        await previous;
        const client = await addClient(session);
        await harness
          .as(session)
          .post(`/clients/${client.id}/subscriptions`)
          .send({ packageId: pkg.id })
          .expect(201);
      }, Promise.resolve());

      const response = await business(session).expect(200);

      expect(response.body.activeClients[5].activeClients).toBe(2);
    });

    it('works out how many ended subscriptions were renewed and how long clients stay', async () => {
      const { session } = await newCoach();
      const pkg = (
        await harness
          .as(session)
          .post('/packages')
          .send({ name: 'Monthly', durationDays: 30, priceMinor: 100_000 })
          .expect(201)
      ).body;
      const sell = (clientId: string, startsOn: string) =>
        harness
          .as(session)
          .post(`/clients/${clientId}/subscriptions`)
          .send({ packageId: pkg.id, startsOn })
          .expect(201);
      const renewer = await addClient(session);
      const leaver = await addClient(session);
      // renewer: 60 days ago, then again 30 days ago, within two weeks of the first ending
      await sell(renewer.id, daysFromToday(-60));
      await sell(renewer.id, daysFromToday(-30));
      // leaver: 70 days ago and never came back
      await sell(leaver.id, daysFromToday(-70));

      const response = await business(session).expect(200);

      // three ended in the last 90 days (the renewer's two, the leaver's one), one of them renewed
      expect(response.body.renewalRatePct).toBe(33.3);
      // renewer 60 days to yesterday (its second ended -1), leaver 30 days: 45 on average
      expect(response.body.averageClientLifetimeDays).toBe(45);
    });

    it('counts the clients who went quiet', async () => {
      const { session, workspaceId } = await newCoach();
      const client = await addClient(session);
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
      ).body.items as { id: string }[];
      await harness.tx.run(
        async () => {
          await (
            [
              [items[0], -2],
              [items[1], -5],
            ] as const
          ).reduce(async (previous, [item, days]) => {
            await previous;

            await harness.tx.db
              .update(checkins)
              .set({ dueOn: daysFromToday(days) })
              .where(eq(checkins.id, item.id));
          }, Promise.resolve());
        },
        { workspaceId },
      );

      const response = await business(session).expect(200);

      expect(response.body.atRiskClients).toBe(1);
    });

    it('shows only the coach’s own numbers', async () => {
      const mine = await newCoach();
      const theirs = await newCoach();
      const client = await addClient(theirs.session);
      const pkg = (
        await harness
          .as(theirs.session)
          .post('/packages')
          .send({ name: 'Monthly', durationDays: 30, priceMinor: 100_000 })
          .expect(201)
      ).body;
      await harness
        .as(theirs.session)
        .post(`/clients/${client.id}/subscriptions`)
        .send({ packageId: pkg.id })
        .expect(201);

      const response = await business(mine.session).expect(200);

      expect(response.body.activeClients[5].activeClients).toBe(0);
    });
  });
});
