import { eq } from 'drizzle-orm';
import { clientConsents, reminders } from '../src/database/schema';
import { RemindersService } from '../src/reminders/reminders.service';
import { WhatsAppTemplate } from '../src/whatsapp/enums/whatsapp-template.enum';
import { HttpTestApp, type TestSession } from './support/http-test-app';

jest.setTimeout(30_000);

interface State {
  type: string;
  status: 'granted' | 'withdrawn' | 'none';
  changedAt: string | null;
  source: string | null;
  textVersion: string | null;
}

describe('Consents over HTTP and the database', () => {
  let harness: HttpTestApp;
  let remindersService: RemindersService;

  beforeAll(async () => {
    harness = await HttpTestApp.start();
    remindersService = harness.app.get(RemindersService);
  });

  afterAll(() => harness.stop(), 60_000);

  const newCoach = async () => {
    const { session } = await harness.signedUpPerson();
    const created = await harness
      .as(session)
      .post('/workspaces')
      .send({ brandName: 'Consent Gym' })
      .expect(201);
    harness.trackWorkspace(created.body.id);
    return { session, workspaceId: created.body.id as string };
  };

  const newClient = async (session: TestSession) => {
    const phone = harness.uniquePhone();
    const body = (
      await harness
        .as(session)
        .post('/clients')
        .send({ fullName: 'Omar Khaled', phone })
        .expect(201)
    ).body as { id: string };
    return { id: body.id, phone };
  };

  const withLink = async () => {
    const coach = await newCoach();
    const client = await newClient(coach.session);
    const link = (
      await harness
        .as(coach.session)
        .post(`/clients/${client.id}/intake-link`)
        .expect(201)
    ).body as { token: string };
    return { ...coach, client, token: link.token };
  };

  const consentsOf = async (session: TestSession, clientId: string) =>
    (await harness.as(session).get(`/clients/${clientId}/consents`).expect(200))
      .body as State[];

  const stateOf = (states: State[], type: string) =>
    states.find((s) => s.type === type)!;

  const answers = {
    age: 31,
    gender: 'male',
    height: 178,
    weight: 82.5,
    goal: 'fat_loss',
    experience: 'beginner',
    trainingDays: 3,
    location: 'gym',
    sleepQuality: 7,
  };
  const submit = (token: string, body: Record<string, unknown>) =>
    harness.server().post(`/api/v1/intake/${token}`).send(body);

  describe('GET /consents/texts', () => {
    it('is open and gives every text with its version and whether it is required', async () => {
      const response = await harness
        .server()
        .get('/api/v1/consents/texts')
        .expect(200);

      expect(response.body.version).toEqual(expect.any(String));
      expect(
        response.body.client.map((t: { type: string; required: boolean }) => [
          t.type,
          t.required,
        ]),
      ).toEqual([
        ['data_processing', true],
        ['health_data', true],
        ['whatsapp_notifications', false],
      ]);
      expect(
        response.body.person.map((t: { type: string; required: boolean }) => [
          t.type,
          t.required,
        ]),
      ).toEqual([
        ['terms', true],
        ['privacy_policy', true],
        ['platform_notifications', false],
      ]);
      for (const text of [...response.body.client, ...response.body.person]) {
        expect(text.textAr).toEqual(expect.any(String));
        expect(text.textEn).toEqual(expect.any(String));
        expect(text.version).toBe(response.body.version);
      }
    });
  });

  describe('signing up', () => {
    it('refuses a registration that does not accept the terms', async () => {
      const response = await harness
        .server()
        .post('/api/v1/auth/register')
        .send(harness.registration({ acceptTerms: false }))
        .expect(400);

      expect(response.body.details ?? response.body.message).toBeDefined();
    });

    it('records the terms, the privacy policy and the chosen notifications the day the person exists', async () => {
      const { session } = await harness.signedUpPerson({
        platformNotifications: true,
      });

      const states = (await harness.as(session).get('/consents/me').expect(200))
        .body as State[];

      expect(states.map((s) => [s.type, s.status, s.source])).toEqual([
        ['terms', 'granted', 'signup'],
        ['privacy_policy', 'granted', 'signup'],
        ['platform_notifications', 'granted', 'signup'],
      ]);
      expect(states[0].textVersion).toEqual(expect.any(String));
    });

    it('treats the optional notifications as not given unless they were chosen', async () => {
      const { session } = await harness.signedUpPerson();

      const states = (await harness.as(session).get('/consents/me').expect(200))
        .body as State[];

      expect(stateOf(states, 'terms').status).toBe('granted');
      expect(stateOf(states, 'platform_notifications').status).toBe('none');
    });
  });

  describe('PUT /consents/me', () => {
    it('lets a person turn the optional notifications on and off, keeping the history', async () => {
      const { session } = await harness.signedUpPerson();

      const on = await harness
        .as(session)
        .put('/consents/me')
        .send({ type: 'platform_notifications', granted: true })
        .expect(200);
      const off = await harness
        .as(session)
        .put('/consents/me')
        .send({ type: 'platform_notifications', granted: false })
        .expect(200);

      expect(stateOf(on.body, 'platform_notifications')).toMatchObject({
        status: 'granted',
        source: 'account',
      });
      expect(stateOf(off.body, 'platform_notifications').status).toBe(
        'withdrawn',
      );
    });

    it('does not let the terms be changed here', async () => {
      const { session } = await harness.signedUpPerson();

      await harness
        .as(session)
        .put('/consents/me')
        .send({ type: 'terms', granted: false })
        .expect(400);
    });

    it('needs a signed-in person', async () => {
      await harness.server().get('/api/v1/consents/me').expect(401);
    });
  });

  describe('the intake form', () => {
    it('shows the client what they are asked to agree to', async () => {
      const { token } = await withLink();

      const view = (
        await harness.server().get(`/api/v1/intake/${token}`).expect(200)
      ).body;

      expect(view.consents.map((c: { type: string }) => c.type)).toEqual([
        'data_processing',
        'health_data',
        'whatsapp_notifications',
      ]);
    });

    it('refuses a submission that says nothing about consent', async () => {
      const { token } = await withLink();

      await submit(token, { answers }).expect(400);
    });

    it.each([
      ['data processing', { dataProcessing: false, healthData: true }],
      ['health data', { dataProcessing: true, healthData: false }],
    ])(
      'refuses a form handed in without agreeing to %s, and leaves the link open',
      async (_name, consents) => {
        const { token, session, client } = await withLink();

        const refused = await submit(token, { answers, consents }).expect(422);

        expect(refused.body.code).toBe('CONSENT_REQUIRED');
        expect(refused.body.details).toHaveLength(1);
        expect(
          stateOf(await consentsOf(session, client.id), 'health_data').status,
        ).not.toBe('granted');
        await submit(token, {
          answers,
          consents: HttpTestApp.ALL_CLIENT_CONSENTS,
        }).expect(201);
      },
    );

    it('records each choice with the wording version and where it was made', async () => {
      const { token, session, client } = await withLink();

      await submit(token, {
        answers,
        consents: {
          dataProcessing: true,
          healthData: true,
          whatsappNotifications: false,
        },
      }).expect(201);

      const states = await consentsOf(session, client.id);
      expect(stateOf(states, 'data_processing')).toMatchObject({
        status: 'granted',
        source: 'intake_link',
        textVersion: expect.any(String),
      });
      expect(stateOf(states, 'health_data').status).toBe('granted');
      expect(stateOf(states, 'whatsapp_notifications').status).toBe('none');
    });

    it('lets a coach read the answers only while the client agrees', async () => {
      const { token, session, client } = await withLink();
      await submit(token, {
        answers,
        consents: HttpTestApp.ALL_CLIENT_CONSENTS,
      }).expect(201);
      await harness.as(session).get(`/clients/${client.id}/intake`).expect(200);

      await harness
        .as(session)
        .post(`/clients/${client.id}/consents/withdraw`)
        .send({ type: 'health_data' })
        .expect(200);

      const refused = await harness
        .as(session)
        .get(`/clients/${client.id}/intake`)
        .expect(403);
      expect(refused.body).toMatchObject({
        code: 'CLIENT_CONSENT_REQUIRED',
        details: ['health_data'],
      });
      await harness
        .as(session)
        .get(`/clients/${client.id}/progress`)
        .expect(403);
    });
  });

  describe('a coach noting a withdrawal', () => {
    it('records it as made on behalf of the client', async () => {
      const { token, session, client } = await withLink();
      await submit(token, {
        answers,
        consents: HttpTestApp.ALL_CLIENT_CONSENTS,
      }).expect(201);

      const states = (
        await harness
          .as(session)
          .post(`/clients/${client.id}/consents/withdraw`)
          .send({ type: 'whatsapp_notifications' })
          .expect(200)
      ).body as State[];

      expect(stateOf(states, 'whatsapp_notifications')).toMatchObject({
        status: 'withdrawn',
        source: 'coach_on_behalf',
      });
      expect(stateOf(states, 'health_data').status).toBe('granted');
    });

    it('adds nothing when the consent was not granted, so the history is not padded', async () => {
      const { session, workspaceId, client } = await withLink();

      await harness
        .as(session)
        .post(`/clients/${client.id}/consents/withdraw`)
        .send({ type: 'whatsapp_notifications' })
        .expect(200);

      const rows = await harness.tx.run(
        () =>
          harness.tx.db
            .select()
            .from(clientConsents)
            .where(eq(clientConsents.clientId, client.id)),
        { workspaceId },
      );
      expect(rows).toEqual([]);
    });

    it('has no way for a coach to give consent for a client', async () => {
      const { session, client } = await withLink();

      await harness
        .as(session)
        .post(`/clients/${client.id}/consents/withdraw`)
        .send({ type: 'health_data', granted: true })
        .expect(400);
      await harness
        .as(session)
        .put(`/clients/${client.id}/consents`)
        .send({ type: 'health_data', granted: true })
        .expect(404);
    });

    it('cannot reach another coach’s client', async () => {
      const mine = await withLink();
      const other = await newCoach();

      await harness
        .as(other.session)
        .get(`/clients/${mine.client.id}/consents`)
        .expect(404);
      await harness
        .as(other.session)
        .post(`/clients/${mine.client.id}/consents/withdraw`)
        .send({ type: 'health_data' })
        .expect(404);
    });
  });

  describe('messages over WhatsApp', () => {
    const withDueCheckin = async (consents: boolean) => {
      const ctx = await withLink();
      if (consents) {
        await submit(ctx.token, {
          answers,
          consents: HttpTestApp.ALL_CLIENT_CONSENTS,
        }).expect(201);
      }
      await harness
        .as(ctx.session)
        .put(`/clients/${ctx.client.id}/checkin-schedule`)
        .send({ frequency: 'daily', sendHour: 0 })
        .expect(200);
      const list = (
        await harness
          .as(ctx.session)
          .get(`/checkins?clientId=${ctx.client.id}&limit=100`)
          .expect(200)
      ).body.items as { id: string; dueOn: string; link: string }[];
      const today = list.sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0];
      return { ...ctx, today, checkinToken: today.link.split('/').pop()! };
    };

    // the database clock may run a little behind this machine's
    const dispatch = async () => {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      await remindersService.dispatchDue();
    };

    const sentTo = (phone: string) =>
      harness.whatsapp.outbox.filter(
        (m) => m.to === phone && m.template === WhatsAppTemplate.CHECKIN_DUE,
      );

    it('are sent to a client who agreed to them', async () => {
      const ctx = await withDueCheckin(true);
      harness.whatsapp.clear();

      await dispatch();

      expect(sentTo(ctx.client.phone)).toHaveLength(1);
    });

    it('are not sent to a client who never agreed, and the reminder says why', async () => {
      const ctx = await withDueCheckin(false);
      harness.whatsapp.clear();

      await dispatch();

      expect(sentTo(ctx.client.phone)).toHaveLength(0);
      const rows = await harness.tx.run(
        () =>
          harness.tx.db
            .select({
              reason: reminders.failedReason,
              clientId: reminders.clientId,
            })
            .from(reminders)
            .where(eq(reminders.clientId, ctx.client.id)),
        { workspaceId: ctx.workspaceId },
      );
      expect(rows.some((r) => r.reason === 'no_consent')).toBe(true);
    });

    it('stop once the client withdraws, from the link they hold', async () => {
      const ctx = await withDueCheckin(true);
      const states = (
        await harness
          .server()
          .put(`/api/v1/checkin/${ctx.checkinToken}/consents`)
          .send({ type: 'whatsapp_notifications', granted: false })
          .expect(200)
      ).body as State[];
      expect(stateOf(states, 'whatsapp_notifications')).toMatchObject({
        status: 'withdrawn',
        source: 'checkin_link',
      });
      harness.whatsapp.clear();

      await dispatch();

      expect(sentTo(ctx.client.phone)).toHaveLength(0);
    });
  });

  describe('check-ins', () => {
    const open = async () => {
      const ctx = await withLink();
      await submit(ctx.token, {
        answers,
        consents: HttpTestApp.ALL_CLIENT_CONSENTS,
      }).expect(201);
      await harness
        .as(ctx.session)
        .put(`/clients/${ctx.client.id}/checkin-schedule`)
        .send({ frequency: 'daily' })
        .expect(200);
      const items = (
        await harness
          .as(ctx.session)
          .get(`/checkins?clientId=${ctx.client.id}&limit=100`)
          .expect(200)
      ).body.items as { id: string; dueOn: string; link: string }[];
      const today = items.sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0];
      return { ...ctx, today, checkinToken: today.link.split('/').pop()! };
    };

    const checkinAnswers = { weight: 81, nutritionDays: 5, trainingDays: 3 };

    it('shows the client their choices and the wording when they open the link', async () => {
      const { checkinToken } = await open();

      const view = (
        await harness
          .server()
          .get(`/api/v1/checkin/${checkinToken}`)
          .expect(200)
      ).body;

      expect(view.consents.texts).toHaveLength(3);
      expect(
        view.consents.states.map((s: State) => [s.type, s.status]),
      ).toEqual([
        ['data_processing', 'granted'],
        ['health_data', 'granted'],
        ['whatsapp_notifications', 'granted'],
      ]);
    });

    it('lets the client change a choice after the check-in is handed in', async () => {
      const { checkinToken } = await open();
      await harness
        .server()
        .post(`/api/v1/checkin/${checkinToken}`)
        .send({ answers: checkinAnswers })
        .expect(201);

      const states = (
        await harness
          .server()
          .put(`/api/v1/checkin/${checkinToken}/consents`)
          .send({ type: 'whatsapp_notifications', granted: false })
          .expect(200)
      ).body as State[];

      expect(stateOf(states, 'whatsapp_notifications').status).toBe(
        'withdrawn',
      );
    });

    it('refuses an answer from a client who took back the health data consent', async () => {
      const { checkinToken } = await open();
      await harness
        .server()
        .put(`/api/v1/checkin/${checkinToken}/consents`)
        .send({ type: 'health_data', granted: false })
        .expect(200);

      const refused = await harness
        .server()
        .post(`/api/v1/checkin/${checkinToken}`)
        .send({ answers: checkinAnswers })
        .expect(403);

      expect(refused.body.code).toBe('CLIENT_CONSENT_REQUIRED');
    });

    it('hides the answers from the coach once the client withdraws, and shows them again if they agree again', async () => {
      const { checkinToken, session, client, today } = await open();
      await harness
        .server()
        .post(`/api/v1/checkin/${checkinToken}`)
        .send({ answers: checkinAnswers })
        .expect(201);
      const read = async () =>
        (await harness.as(session).get(`/checkins/${today.id}`).expect(200))
          .body as {
          answers: Record<string, unknown> | null;
          answersHidden: boolean;
        };
      expect((await read()).answersHidden).toBe(false);
      expect((await read()).answers).not.toBeNull();

      await harness
        .as(session)
        .post(`/clients/${client.id}/consents/withdraw`)
        .send({ type: 'data_processing' })
        .expect(200);

      expect(await read()).toMatchObject({
        answers: null,
        answersHidden: true,
      });
      const listed = (
        await harness
          .as(session)
          .get(`/checkins?clientId=${client.id}&limit=100`)
          .expect(200)
      ).body.items as { id: string; answers: unknown }[];
      expect(listed.find((i) => i.id === today.id)!.answers).toBeNull();

      await harness
        .server()
        .put(`/api/v1/checkin/${checkinToken}/consents`)
        .send({ type: 'data_processing', granted: true })
        .expect(200);
      expect((await read()).answersHidden).toBe(false);
    });

    it('does not accept a consent change for a link that does not exist', async () => {
      await harness
        .server()
        .put('/api/v1/checkin/ZZZZZZZZ/consents')
        .send({ type: 'whatsapp_notifications', granted: false })
        .expect(404);
    });
  });
});
