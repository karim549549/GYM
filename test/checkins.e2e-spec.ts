import { randomUUID } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { CheckinsService } from '../src/checkins/checkins.service';
import { checkins, measurements, reminders } from '../src/database/schema';
import { RemindersService } from '../src/reminders/reminders.service';
import { WhatsAppTemplate } from '../src/whatsapp/enums/whatsapp-template.enum';
import { HttpTestApp, type TestSession } from './support/http-test-app';

jest.setTimeout(30_000);

describe('Check-ins over HTTP and the database', () => {
  let harness: HttpTestApp;
  let checkinsService: CheckinsService;
  let remindersService: RemindersService;

  beforeAll(async () => {
    harness = await HttpTestApp.start();
    checkinsService = harness.app.get(CheckinsService);
    remindersService = harness.app.get(RemindersService);
  });

  afterAll(() => harness.stop(), 60_000);

  const newCoach = async (brandName = 'Checkin Gym') => {
    const { session } = await harness.signedUpPerson();
    const created = await harness
      .as(session)
      .post('/workspaces')
      .send({ brandName })
      .expect(201);
    harness.trackWorkspace(created.body.id);
    return { session, workspaceId: created.body.id as string };
  };

  const addClient = async (session: TestSession, fullName = 'Omar Khaled') => {
    const phone = harness.uniquePhone();
    const body = (
      await harness
        .as(session)
        .post('/clients')
        .send({ fullName, phone })
        .expect(201)
    ).body as { id: string };
    return { ...body, phone };
  };

  const ready = async (brandName?: string) => {
    const coach = await newCoach(brandName);
    const client = await addClient(coach.session);
    await harness.grantClientConsents(coach.workspaceId, client.id);
    return { ...coach, client };
  };

  const schedule = (
    session: TestSession,
    clientId: string,
    body: Record<string, unknown>,
  ) =>
    harness.as(session).put(`/clients/${clientId}/checkin-schedule`).send(body);

  const checkinsOf = async (
    session: TestSession,
    clientId: string,
    query = '',
  ) =>
    (
      await harness
        .as(session)
        .get(`/checkins?clientId=${clientId}&limit=100${query}`)
        .expect(200)
    ).body.items as {
      id: string;
      dueOn: string;
      status: string;
      link: string;
      answers: Record<string, unknown> | null;
      submittedAt: string | null;
      coachReply: string | null;
      repliedAt: string | null;
    }[];

  const tokenOf = (link: string) => link.split('/').pop() as string;

  const daysFromToday = (days: number) => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
    }).format(new Date());
    const moved = new Date(Date.parse(`${today}T00:00:00Z`));
    moved.setUTCDate(moved.getUTCDate() + days);
    return moved.toISOString().slice(0, 10);
  };

  /** A coach with a client asked for a check-in every day, so one is due today. */
  const withDueToday = async (brandName?: string, sendHour?: number) => {
    const base = await ready(brandName);
    await schedule(base.session, base.client.id, {
      frequency: 'daily',
      sendHour,
    }).expect(200);
    const items = await checkinsOf(base.session, base.client.id);
    const today = items.find((item) => item.dueOn === daysFromToday(0))!;
    return { ...base, items, today, token: tokenOf(today.link) };
  };

  const answers = { weight: 82.5, nutritionDays: 5, trainingDays: 3 };

  const open = (token: string) =>
    harness.server().get(`/api/v1/checkin/${token}`);
  const submit = (token: string, body: Record<string, unknown>) =>
    harness.server().post(`/api/v1/checkin/${token}`).send(body);

  describe('PUT /clients/:id/checkin-schedule', () => {
    it('asks for a check-in every Friday and creates the next four weeks of them', async () => {
      const { session, client } = await ready();

      const response = await schedule(session, client.id, {
        frequency: 'weekly',
        dayOfWeek: 5,
        sendHour: 9,
      }).expect(200);
      const items = await checkinsOf(session, client.id);

      expect(response.body).toEqual({
        frequency: 'weekly',
        dayOfWeek: 5,
        sendHour: 9,
        isActive: true,
      });
      expect(items.length).toBeGreaterThanOrEqual(4);
      expect(items.length).toBeLessThanOrEqual(5);
      for (const item of items) {
        expect(new Date(`${item.dueOn}T00:00:00Z`).getUTCDay()).toBe(5);
        expect(item.status).toBe('pending');
        expect(item.link).toMatch(
          /^http:\/\/localhost:3001\/c\/[A-Za-z0-9]{8}$/,
        );
      }
    });

    it('defaults to a weekly check-in on Friday at 8', async () => {
      const { session, client } = await ready();

      const response = await schedule(session, client.id, {}).expect(200);

      expect(response.body).toEqual({
        frequency: 'weekly',
        dayOfWeek: 5,
        sendHour: 8,
        isActive: true,
      });
    });

    it('asks every day, today included, for a daily check-in', async () => {
      const { session, client } = await ready();

      await schedule(session, client.id, { frequency: 'daily' }).expect(200);
      const items = await checkinsOf(session, client.id);

      expect(items).toHaveLength(29);
      expect(items.map((item) => item.dueOn)).toEqual(
        expect.arrayContaining([daysFromToday(0), daysFromToday(28)]),
      );
    });

    it('keeps no weekday for a check-in that is not weekly', async () => {
      const { session, client } = await ready();

      const response = await schedule(session, client.id, {
        frequency: 'every_2_days',
        dayOfWeek: 3,
      }).expect(200);

      expect(response.body.dayOfWeek).toBeNull();
    });

    it('does not make a second set of days when saved again', async () => {
      const { session, client } = await ready();
      const body = { frequency: 'weekly', dayOfWeek: 2 };

      await schedule(session, client.id, body).expect(200);
      const first = await checkinsOf(session, client.id);
      await schedule(session, client.id, body).expect(200);
      const second = await checkinsOf(session, client.id);

      expect(second.map((i) => i.dueOn).sort()).toEqual(
        first.map((i) => i.dueOn).sort(),
      );
    });

    it('replaces the coming check-ins when the rhythm changes, keeping those handed in', async () => {
      const { session, client } = await ready();
      await schedule(session, client.id, { frequency: 'daily' }).expect(200);
      const before = await checkinsOf(session, client.id);
      const today = before.find((i) => i.dueOn === daysFromToday(0))!;
      await submit(tokenOf(today.link), { answers }).expect(201);

      await schedule(session, client.id, {
        frequency: 'weekly',
        dayOfWeek: 1,
      }).expect(200);
      const after = await checkinsOf(session, client.id);

      const submitted = after.filter((i) => i.status === 'submitted');
      expect(submitted.map((i) => i.id)).toEqual([today.id]);
      const coming = after.filter((i) => i.dueOn > daysFromToday(0));
      expect(coming.length).toBeGreaterThanOrEqual(4);
      for (const item of coming) {
        expect(new Date(`${item.dueOn}T00:00:00Z`).getUTCDay()).toBe(1);
      }
    });

    it('plans the link to go to the client at the chosen hour for each check-in', async () => {
      const { session, workspaceId, client } = await ready();

      await schedule(session, client.id, {
        frequency: 'weekly',
        dayOfWeek: 5,
      }).expect(200);
      const items = await checkinsOf(session, client.id);
      const planned = await harness.tx.run(
        () =>
          harness.tx.db
            .select({ subjectId: reminders.subjectId, kind: reminders.kind })
            .from(reminders)
            .where(eq(reminders.clientId, client.id)),
        { workspaceId },
      );

      expect(planned.map((r) => r.subjectId).sort()).toEqual(
        items.map((i) => i.id).sort(),
      );
      expect(planned.every((r) => r.kind === 'checkin_due')).toBe(true);
    });

    it.each([
      ['a frequency nobody offers', { frequency: 'hourly' }],
      [
        'a day of the week past Saturday',
        { frequency: 'weekly', dayOfWeek: 7 },
      ],
      ['a negative day of the week', { frequency: 'weekly', dayOfWeek: -1 }],
      ['an hour of 24', { sendHour: 24 }],
      ['a fractional hour', { sendHour: 8.5 }],
    ])('refuses %s', async (_label, body) => {
      const { session, client } = await ready();

      await schedule(session, client.id, body).expect(400);
    });

    it('does not reach another coach’s client', async () => {
      const mine = await ready();
      const theirs = await ready();

      const response = await schedule(
        mine.session,
        theirs.client.id,
        {},
      ).expect(404);

      expect(response.body.code).toBe('CLIENT_NOT_FOUND');
    });
  });

  describe('GET and DELETE /clients/:id/checkin-schedule', () => {
    it('is not found before one is set', async () => {
      const { session, client } = await ready();

      const response = await harness
        .as(session)
        .get(`/clients/${client.id}/checkin-schedule`)
        .expect(404);

      expect(response.body.code).toBe('CHECKIN_SCHEDULE_NOT_FOUND');
    });

    it('reads what was set', async () => {
      const { session, client } = await ready();
      await schedule(session, client.id, {
        frequency: 'fortnightly',
        dayOfWeek: 0,
        sendHour: 18,
      }).expect(200);

      const response = await harness
        .as(session)
        .get(`/clients/${client.id}/checkin-schedule`)
        .expect(200);

      expect(response.body).toEqual({
        frequency: 'fortnightly',
        dayOfWeek: 0,
        sendHour: 18,
        isActive: true,
      });
    });

    it('stops asking: the schedule stays but is off, and the coming check-ins and their links are gone', async () => {
      const { session, workspaceId, client } = await ready();
      await schedule(session, client.id, { frequency: 'daily' }).expect(200);

      await harness
        .as(session)
        .delete(`/clients/${client.id}/checkin-schedule`)
        .expect(204);
      const read = await harness
        .as(session)
        .get(`/clients/${client.id}/checkin-schedule`)
        .expect(200);
      const items = await checkinsOf(session, client.id);
      const planned = await harness.tx.run(
        () =>
          harness.tx.db
            .select({ id: reminders.id, scheduledFor: reminders.scheduledFor })
            .from(reminders)
            .where(
              and(
                eq(reminders.clientId, client.id),
                gt(reminders.scheduledFor, new Date(Date.now() + 3_600_000)),
              ),
            ),
        { workspaceId },
      );

      expect(read.body.isActive).toBe(false);
      expect(items.every((i) => i.dueOn <= daysFromToday(0))).toBe(true);
      expect(planned).toEqual([]);
    });

    it('is not found to stop one that was never set', async () => {
      const { session, client } = await ready();

      await harness
        .as(session)
        .delete(`/clients/${client.id}/checkin-schedule`)
        .expect(404);
    });

    it('turns on again when set again', async () => {
      const { session, client } = await ready();
      await schedule(session, client.id, { frequency: 'weekly' }).expect(200);
      await harness
        .as(session)
        .delete(`/clients/${client.id}/checkin-schedule`)
        .expect(204);

      const response = await schedule(session, client.id, {
        frequency: 'weekly',
      }).expect(200);

      expect(response.body.isActive).toBe(true);
      expect((await checkinsOf(session, client.id)).length).toBeGreaterThan(0);
    });
  });

  describe('the check-in form a client opens', () => {
    it('shows the coach’s brand, the client’s name, the day and the questions, and nothing private', async () => {
      const { token } = await withDueToday('Coach Mona Fitness');

      const response = await open(token).expect(200);

      expect(response.body).toEqual({
        coach: { brandName: 'Coach Mona Fitness', logoUrl: null },
        client: { fullName: 'Omar Khaled' },
        dueOn: daysFromToday(0),
        form: expect.objectContaining({
          version: 'checkin_v1',
          units: { weight: 'kg', height: 'cm' },
        }),
        consents: {
          texts: expect.any(Array),
          states: expect.any(Array),
        },
      });
      // the wording of a consent talks about phone numbers; the data around it must carry none
      expect(
        JSON.stringify({ ...response.body, consents: undefined }),
      ).not.toMatch(/\+20|phone|workspaceId/);
    });

    it('is not open before its day', async () => {
      const { items } = await withDueToday();
      const later = items.find((i) => i.dueOn === daysFromToday(1))!;

      const response = await open(tokenOf(later.link)).expect(409);

      expect(response.body.code).toBe('CHECKIN_NOT_OPEN');
    });

    it('has expired two weeks after its day', async () => {
      const { workspaceId, today, token } = await withDueToday();
      await harness.tx.run(
        () =>
          harness.tx.db
            .update(checkins)
            .set({ dueOn: daysFromToday(-14) })
            .where(eq(checkins.id, today.id)),
        { workspaceId },
      );

      const response = await open(token).expect(410);

      expect(response.body.code).toBe('CHECKIN_EXPIRED');
    });

    it('is not found for a link that does not exist', async () => {
      const response = await open('Zz9Zz9Zz').expect(404);

      expect(response.body.code).toBe('CHECKIN_NOT_FOUND');
    });

    it('refuses a token that cannot be one', async () => {
      await open('short').expect(400);
      await open('has-dash!').expect(400);
    });
  });

  describe('handing in a check-in', () => {
    it('keeps the answers, marks it submitted and writes the numbers as measurements', async () => {
      const { session, workspaceId, client, today, token } =
        await withDueToday();

      const response = await submit(token, {
        answers: {
          ...answers,
          waist: 88,
          sleepQuality: 7,
          note: '  Felt good  ',
        },
      }).expect(201);
      const [item] = (await checkinsOf(session, client.id)).filter(
        (i) => i.id === today.id,
      );
      const stored = await harness.tx.run(
        () =>
          harness.tx.db
            .select({
              metric: measurements.metric,
              value: measurements.value,
              unit: measurements.unit,
              source: measurements.source,
            })
            .from(measurements)
            .where(eq(measurements.clientId, client.id)),
        { workspaceId },
      );

      expect(response.body).toEqual({ submittedAt: expect.any(String) });
      expect(item).toMatchObject({
        status: 'submitted',
        answers: { ...answers, waist: 88, sleepQuality: 7, note: 'Felt good' },
        submittedAt: response.body.submittedAt,
      });
      expect(stored).toEqual(
        expect.arrayContaining([
          { metric: 'weight', value: 82.5, unit: 'kg', source: 'checkin' },
          { metric: 'waist', value: 88, unit: 'cm', source: 'checkin' },
          {
            metric: 'sleep_quality',
            value: 7,
            unit: 'score',
            source: 'checkin',
          },
        ]),
      );
    });

    it('lists every problem at once and keeps nothing', async () => {
      const { session, client, today, token } = await withDueToday();

      const response = await submit(token, {
        answers: { weight: 5, nutritionDays: 9, shoeSize: 43 },
      }).expect(422);
      const [item] = (await checkinsOf(session, client.id)).filter(
        (i) => i.id === today.id,
      );

      expect(response.body.code).toBe('INVALID_CHECKIN_ANSWERS');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          'weight: invalid',
          'nutritionDays: invalid',
          'trainingDays: required',
          'shoeSize: unknown',
        ]),
      );
      expect(item.status).toBe('pending');
      await open(token).expect(200);
    });

    it('refuses a body without answers', async () => {
      const { token } = await withDueToday();

      await submit(token, {}).expect(400);
    });

    it('can be handed in only once', async () => {
      const { token } = await withDueToday();
      await submit(token, { answers }).expect(201);

      const response = await submit(token, { answers }).expect(409);

      expect(response.body.code).toBe('CHECKIN_ALREADY_SUBMITTED');
    });

    it('lets exactly one of two simultaneous submissions through', async () => {
      const { token } = await withDueToday();

      const results = await Promise.all([
        submit(token, { answers }),
        submit(token, { answers }),
      ]);

      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    });

    it('is refused before its day', async () => {
      const { items } = await withDueToday();
      const later = items.find((i) => i.dueOn === daysFromToday(1))!;

      await submit(tokenOf(later.link), { answers }).expect(409);
    });

    it('replaces the same day’s reading when the client answers again another way', async () => {
      const { workspaceId, client, token } = await withDueToday();
      await harness.tx.run(
        () =>
          harness.tx.db.insert(measurements).values({
            workspaceId,
            clientId: client.id,
            metric: 'weight',
            value: 90,
            unit: 'kg',
            measuredAt: daysFromToday(0),
          }),
        { workspaceId },
      );

      await submit(token, { answers }).expect(201);
      const stored = await harness.tx.run(
        () =>
          harness.tx.db
            .select({ value: measurements.value })
            .from(measurements)
            .where(
              and(
                eq(measurements.clientId, client.id),
                eq(measurements.metric, 'weight'),
              ),
            ),
        { workspaceId },
      );

      expect(stored).toEqual([{ value: 82.5 }]);
    });
  });

  describe('what the coach sees', () => {
    it('lists the missed ones: due in the past and never handed in', async () => {
      const { session, workspaceId, client, today } = await withDueToday();
      await harness.tx.run(
        () =>
          harness.tx.db
            .update(checkins)
            .set({ dueOn: daysFromToday(-3) })
            .where(eq(checkins.id, today.id)),
        { workspaceId },
      );

      const missed = await checkinsOf(session, client.id, '&status=missed');

      expect(missed.map((i) => i.id)).toEqual([today.id]);
      expect(missed[0].status).toBe('missed');
    });

    it('lists handed-in ones first, newest first, and filters to those waiting for a reply', async () => {
      const { session, client, today, items } = await withDueToday();
      const first = today;
      const second = items.find((i) => i.id !== today.id)!;
      await harness
        .as(session)
        .post(`/checkins/${first.id}/reply`)
        .send({ text: 'x' })
        .expect(409);
      await submit(tokenOf(first.link), { answers }).expect(201);
      expect(second.id).not.toBe(first.id);

      const submitted = await checkinsOf(
        session,
        client.id,
        '&status=submitted',
      );
      const waiting = await checkinsOf(session, client.id, '&needsReply=true');

      expect(submitted.map((i) => i.id)).toEqual([first.id]);
      expect(waiting.map((i) => i.id)).toEqual([first.id]);
    });

    it('shows one check-in', async () => {
      const { session, today } = await withDueToday();

      const response = await harness
        .as(session)
        .get(`/checkins/${today.id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: today.id,
        dueOn: daysFromToday(0),
        status: 'pending',
        answers: null,
        coachReply: null,
      });
    });

    it('is not found for an id that is not there', async () => {
      const { session } = await ready();

      const response = await harness
        .as(session)
        .get(`/checkins/${randomUUID()}`)
        .expect(404);

      expect(response.body.code).toBe('CHECKIN_NOT_FOUND');
    });

    it('does not show another coach’s check-ins', async () => {
      const mine = await ready();
      const theirs = await withDueToday();

      await harness
        .as(mine.session)
        .get(`/checkins/${theirs.today.id}`)
        .expect(404);
      const list = await harness.as(mine.session).get('/checkins').expect(200);
      expect(list.body.total).toBe(0);
    });

    it('names the clients who went quiet: two or more missed in the last thirty days', async () => {
      const { session, workspaceId, client, items } = await withDueToday();
      const [a, b, c] = items;
      await harness.tx.run(
        async () => {
          for (const [item, days] of [
            [a, -2],
            [b, -5],
          ] as const) {
            await harness.tx.db
              .update(checkins)
              .set({ dueOn: daysFromToday(days) })
              .where(eq(checkins.id, item.id));
          }
        },
        { workspaceId },
      );
      expect(c).toBeDefined();

      const response = await harness
        .as(session)
        .get('/checkins/at-risk')
        .expect(200);

      expect(response.body.items).toEqual([
        { clientId: client.id, missedCount: 2 },
      ]);
    });

    it('does not name a client who missed only one', async () => {
      const { session, workspaceId, today } = await withDueToday();
      await harness.tx.run(
        () =>
          harness.tx.db
            .update(checkins)
            .set({ dueOn: daysFromToday(-2) })
            .where(eq(checkins.id, today.id)),
        { workspaceId },
      );

      const response = await harness
        .as(session)
        .get('/checkins/at-risk')
        .expect(200);

      expect(response.body.items).toEqual([]);
    });
  });

  describe('POST /checkins/:id/reply', () => {
    it('adds the coach’s written reply to a handed-in check-in, and can be changed', async () => {
      const { session, today, token } = await withDueToday();
      await submit(token, { answers }).expect(201);
      const url = `/checkins/${today.id}/reply`;

      const first = await harness
        .as(session)
        .post(url)
        .send({ text: '  Great week  ' })
        .expect(201);
      const second = await harness
        .as(session)
        .post(url)
        .send({ text: 'Keep going' })
        .expect(201);

      expect(first.body).toMatchObject({
        coachReply: 'Great week',
        repliedAt: expect.any(String),
      });
      expect(second.body.coachReply).toBe('Keep going');
    });

    it('is refused for a check-in not handed in yet', async () => {
      const { session, today } = await withDueToday();

      const response = await harness
        .as(session)
        .post(`/checkins/${today.id}/reply`)
        .send({ text: 'Hi' })
        .expect(409);

      expect(response.body.code).toBe('CHECKIN_NOT_SUBMITTED');
    });

    it.each([
      ['an empty reply', { text: '   ' }],
      ['no reply', {}],
      ['a reply over 2000 characters', { text: 'x'.repeat(2001) }],
    ])('refuses %s', async (_label, body) => {
      const { session, today, token } = await withDueToday();
      await submit(token, { answers }).expect(201);

      await harness
        .as(session)
        .post(`/checkins/${today.id}/reply`)
        .send(body)
        .expect(400);
    });

    it('does not reach another coach’s check-in', async () => {
      const mine = await ready();
      const theirs = await withDueToday();
      await submit(theirs.token, { answers }).expect(201);

      await harness
        .as(mine.session)
        .post(`/checkins/${theirs.today.id}/reply`)
        .send({ text: 'Hi' })
        .expect(404);
    });
  });

  describe('keeping the next check-ins created', () => {
    it('creates what is missing from the end of what exists, without shifting the rhythm', async () => {
      const { session, workspaceId, client } = await ready();
      await schedule(session, client.id, {
        frequency: 'weekly',
        dayOfWeek: 5,
      }).expect(200);
      const before = await checkinsOf(session, client.id);
      await harness.tx.run(
        () =>
          harness.tx.db
            .delete(checkins)
            .where(
              and(
                eq(checkins.clientId, client.id),
                gt(checkins.dueOn, daysFromToday(8)),
              ),
            ),
        { workspaceId },
      );
      const kept = await checkinsOf(session, client.id);
      expect(kept.length).toBeLessThan(before.length);

      await checkinsService.topUp();
      const after = await checkinsOf(session, client.id);

      expect(after.map((i) => i.dueOn).sort()).toEqual(
        before.map((i) => i.dueOn).sort(),
      );
    });

    it('does nothing for a schedule that was stopped', async () => {
      const { session, client } = await ready();
      await schedule(session, client.id, { frequency: 'daily' }).expect(200);
      await harness
        .as(session)
        .delete(`/clients/${client.id}/checkin-schedule`)
        .expect(204);
      const before = await checkinsOf(session, client.id);

      await checkinsService.topUp();

      expect(await checkinsOf(session, client.id)).toHaveLength(before.length);
    });

    it('carries on past a client who was removed', async () => {
      const gone = await ready();
      await schedule(gone.session, gone.client.id, {
        frequency: 'daily',
      }).expect(200);
      await harness
        .as(gone.session)
        .delete(`/clients/${gone.client.id}`)
        .expect(204);
      const fine = await ready();
      await schedule(fine.session, fine.client.id, {
        frequency: 'weekly',
      }).expect(200);
      await harness.tx.run(
        () =>
          harness.tx.db
            .delete(checkins)
            .where(eq(checkins.clientId, fine.client.id)),
        { workspaceId: fine.workspaceId },
      );

      await expect(checkinsService.topUp()).resolves.toBeGreaterThanOrEqual(1);

      expect(
        (await checkinsOf(fine.session, fine.client.id)).length,
      ).toBeGreaterThan(0);
    });
  });

  describe('telling the client', () => {
    it('sends the link in WhatsApp when the check-in is due', async () => {
      const { client, today } = await withDueToday('Coach Hana', 0);
      harness.whatsapp.clear();

      // a reminder due "right away" is stamped by this machine's clock; the database's may run a little behind
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      await remindersService.dispatchDue();

      const message = harness.whatsapp.outbox.find(
        (m) =>
          m.to === client.phone && m.template === WhatsAppTemplate.CHECKIN_DUE,
      );
      expect(message).toBeDefined();
      expect(message!.language).toBe('ar');
      expect(message!.params).toEqual([
        'Omar Khaled',
        'Coach Hana',
        today.link,
      ]);
    });
  });
});
