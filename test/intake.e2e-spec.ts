import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  intakeLinks,
  intakeResponses,
  measurements,
  workspaces,
} from '../src/database/schema';
import { HttpTestApp, type TestSession } from './support/http-test-app';
// a flow here registers a coach, a workspace and a client before it starts; against the hosted database that outlasts 5 seconds
jest.setTimeout(30_000);

describe('Intake over HTTP', () => {
  let harness: HttpTestApp;

  beforeAll(async () => {
    harness = await HttpTestApp.start();
  });

  afterAll(() => harness.stop(), 60_000);

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
    medications: '  Vitamin D  ',
  };

  const newCoach = async (brandName = 'Intake Gym') => {
    const { session } = await harness.signedUpPerson();
    const created = await harness
      .as(session)
      .post('/workspaces')
      .send({ brandName })
      .expect(201);
    harness.trackWorkspace(created.body.id);
    return { session, workspaceId: created.body.id as string };
  };

  const newClient = async (session: TestSession, fullName = 'Omar Khaled') =>
    (
      await harness
        .as(session)
        .post('/clients')
        .send({ fullName, phone: harness.uniquePhone() })
        .expect(201)
    ).body as { id: string; phone: string; fullName: string };

  const makeLink = (session: TestSession, clientId: string) =>
    harness.as(session).post(`/clients/${clientId}/intake-link`);

  /** A coach, one client and an open link, ready for the client to open. */
  const ready = async (brandName?: string) => {
    const coach = await newCoach(brandName);
    const client = await newClient(coach.session);
    const link = (await makeLink(coach.session, client.id).expect(201))
      .body as {
      token: string;
      url: string;
      expiresAt: string;
    };
    return { ...coach, client, link };
  };

  const open = (token: string) =>
    harness.server().get(`/api/v1/intake/${token}`);
  const submit = (token: string, body: unknown) =>
    harness
      .server()
      .post(`/api/v1/intake/${token}`)
      .send({ consents: HttpTestApp.ALL_CLIENT_CONSENTS, ...(body as object) });

  const inWorkspace = <T>(workspaceId: string, work: () => Promise<T>) =>
    harness.tx.run(work, { workspaceId });

  describe('POST /clients/:id/intake-link: the coach makes a link', () => {
    it('makes a short link that opens the form, good for fourteen days', async () => {
      const { client, session } = await (async () => {
        const coach = await newCoach();
        return {
          session: coach.session,
          client: await newClient(coach.session),
        };
      })();

      const response = await makeLink(session, client.id).expect(201);

      expect(response.body).toEqual({
        token: expect.stringMatching(/^[A-Za-z0-9]{8}$/),
        url: expect.stringMatching(
          new RegExp(
            `^http://localhost:3001/intake/[a-z0-9-]+/${response.body.token}$`,
          ),
        ),
        expiresAt: expect.any(String),
        namedFormId: null,
      });
      const days =
        (new Date(response.body.expiresAt).getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(13.9);
      expect(days).toBeLessThan(14.1);
    });

    it('gives the same link back while it is still open, so a coach cannot lose track of it', async () => {
      const { client, link, session } = await ready();

      const again = await makeLink(session, client.id).expect(201);

      expect(again.body.token).toBe(link.token);
    });

    it('gives every client a link of their own', async () => {
      const coach = await newCoach();
      const first = await newClient(coach.session, 'First');
      const second = await newClient(coach.session, 'Second');

      const a = await makeLink(coach.session, first.id).expect(201);
      const b = await makeLink(coach.session, second.id).expect(201);

      expect(a.body.token).not.toBe(b.body.token);
    });

    it('makes a new link once the old one has expired', async () => {
      const { client, link, session, workspaceId } = await ready();
      await inWorkspace(workspaceId, () =>
        harness.tx.db
          .update(intakeLinks)
          .set({ expiresAt: new Date(Date.now() - 1000) })
          .where(eq(intakeLinks.token, link.token)),
      );

      const fresh = await makeLink(session, client.id).expect(201);

      expect(fresh.body.token).not.toBe(link.token);
      await open(fresh.body.token).expect(200);
    });

    it('does not exist for a client who is not this coach’s', async () => {
      const mine = await newCoach();
      const theirs = await newCoach();
      const client = await newClient(theirs.session);

      const response = await makeLink(mine.session, client.id).expect(404);

      expect(response.body.code).toBe('CLIENT_NOT_FOUND');
    });

    it('does not exist for a client who was removed', async () => {
      const { session, client } = await ready();
      await harness.as(session).delete(`/clients/${client.id}`).expect(204);

      await makeLink(session, client.id).expect(404);
    });

    it('refuses an id that is not an id', async () => {
      const { session } = await newCoach();

      await harness.as(session).post('/clients/nope/intake-link').expect(400);
    });

    it('tells a person with no workspace to create one first', async () => {
      const { session } = await harness.signedUpPerson();

      const response = await makeLink(session, randomUUID()).expect(403);

      expect(response.body.code).toBe('NO_WORKSPACE');
    });

    it('needs a token', async () => {
      await harness
        .server()
        .post(`/api/v1/clients/${randomUUID()}/intake-link`)
        .expect(401);
    });
  });

  describe('GET /intake/:token: the client opens the link', () => {
    it('shows the form with the coach’s brand, with no login', async () => {
      const { link } = await ready('Sara Fit');

      const response = await open(link.token).expect(200);

      expect(response.body).toMatchObject({
        coach: { brandName: 'Sara Fit', logoUrl: null },
        client: { fullName: 'Omar Khaled' },
        expiresAt: link.expiresAt,
        form: {
          version: 'default_v1',
          units: { weight: 'kg', height: 'cm' },
        },
      });
      expect(
        response.body.form.questions.map((q: { id: string }) => q.id),
      ).toContain('weight');
    });

    it('asks in the workspace’s units', async () => {
      const { link, session } = await ready();
      await harness
        .as(session)
        .patch('/workspaces/current')
        .send({ unitSystem: 'imperial' })
        .expect(200);

      const response = await open(link.token).expect(200);

      expect(response.body.form.units).toEqual({ weight: 'lb', height: 'in' });
    });

    it('shows the coach’s logo when they have one', async () => {
      const { link, workspaceId } = await ready();
      // the logo is a key in storage; the address is built when it is read
      await inWorkspace(workspaceId, () =>
        harness.tx.db
          .update(workspaces)
          .set({ logoKey: `workspaces/${workspaceId}/logo-aaaaaaaaaaaa.webp` })
          .where(eq(workspaces.id, workspaceId)),
      );

      const response = await open(link.token).expect(200);

      expect(response.body.coach.logoUrl).toContain(
        '/object/public/gym-public/',
      );
    });

    it('tells the client nothing they do not need: no phone, no ids', async () => {
      const { link, client, workspaceId } = await ready();

      const text = JSON.stringify((await open(link.token).expect(200)).body);

      expect(text).not.toContain(client.phone);
      expect(text).not.toContain(client.id);
      expect(text).not.toContain(workspaceId);
    });

    it('does not exist for a token nobody has', async () => {
      const response = await open('Zz9Zz9Zz').expect(404);

      expect(response.body.code).toBe('INTAKE_LINK_NOT_FOUND');
    });

    it.each(['short', 'toolongtoken', 'bad-char!', 'a b c d e'])(
      'refuses %j as a token before looking anything up',
      async (token) => {
        const response = await open(token).expect(400);

        expect(response.body.code).toBe('VALIDATION_FAILED');
      },
    );

    it('says the link has expired once it has', async () => {
      const { link, workspaceId } = await ready();
      await inWorkspace(workspaceId, () =>
        harness.tx.db
          .update(intakeLinks)
          .set({ expiresAt: new Date(Date.now() - 1000) })
          .where(eq(intakeLinks.token, link.token)),
      );

      const response = await open(link.token).expect(410);

      expect(response.body.code).toBe('INTAKE_LINK_EXPIRED');
    });

    it('does not exist once the client has been removed', async () => {
      const { link, session, client } = await ready();
      await harness.as(session).delete(`/clients/${client.id}`).expect(204);

      const response = await open(link.token).expect(404);

      expect(response.body.code).toBe('INTAKE_LINK_NOT_FOUND');
    });
  });

  describe('POST /intake/:token: the client hands in their details', () => {
    it('saves the answers, closes the link and marks the client as done', async () => {
      const { link, session, client } = await ready();

      const response = await submit(link.token, { answers }).expect(201);

      expect(response.body).toEqual({ submittedAt: expect.any(String) });
      const updated = await harness.as(session).get(`/clients/${client.id}`);
      expect(updated.body.intakeStatus).toBe('submitted');
      const closed = await open(link.token).expect(409);
      expect(closed.body.code).toBe('INTAKE_ALREADY_SUBMITTED');
    });

    it('lets the coach read what was answered, as it was kept', async () => {
      const { link, session, client } = await ready();
      await submit(link.token, { answers }).expect(201);

      const response = await harness
        .as(session)
        .get(`/clients/${client.id}/intake`)
        .expect(200);

      expect(response.body).toEqual({
        submittedAt: expect.any(String),
        submittedBy: 'client',
        formVersion: 'default_v1',
        templateId: null,
        answers: { ...answers, medications: 'Vitamin D' },
      });
    });

    it('turns the numbers into measurements, in the same step', async () => {
      const { link, client, workspaceId } = await ready();
      await submit(link.token, { answers }).expect(201);

      const rows = await inWorkspace(workspaceId, () =>
        harness.tx.db
          .select({
            metric: measurements.metric,
            value: measurements.value,
            unit: measurements.unit,
            source: measurements.source,
          })
          .from(measurements)
          .where(eq(measurements.clientId, client.id)),
      );

      expect(rows).toHaveLength(3);
      expect(rows).toEqual(
        expect.arrayContaining([
          { metric: 'weight', value: 82.5, unit: 'kg', source: 'intake' },
          { metric: 'height', value: 178, unit: 'cm', source: 'intake' },
          {
            metric: 'sleep_quality',
            value: 7,
            unit: 'score',
            source: 'intake',
          },
        ]),
      );
    });

    it('can only be handed in once, however many times it is tried', async () => {
      const { link, client, workspaceId } = await ready();
      await submit(link.token, { answers }).expect(201);

      const again = await submit(link.token, { answers }).expect(409);

      expect(again.body.code).toBe('INTAKE_ALREADY_SUBMITTED');
      const responses = await inWorkspace(workspaceId, () =>
        harness.tx.db
          .select({ id: intakeResponses.id })
          .from(intakeResponses)
          .where(eq(intakeResponses.clientId, client.id)),
      );
      expect(responses).toHaveLength(1);
    });

    it('lets exactly one of two simultaneous submissions through', async () => {
      const { link, client, workspaceId } = await ready();

      const [first, second] = await Promise.all([
        submit(link.token, { answers }),
        submit(link.token, { answers }),
      ]);

      expect([first.status, second.status].sort((a, b) => a - b)).toEqual([
        201, 409,
      ]);
      const responses = await inWorkspace(workspaceId, () =>
        harness.tx.db
          .select({ id: intakeResponses.id })
          .from(intakeResponses)
          .where(eq(intakeResponses.clientId, client.id)),
      );
      expect(responses).toHaveLength(1);
    });

    it('says which answers need another look, and saves nothing', async () => {
      const { link, session, client, workspaceId } = await ready();
      const { age: _age, ...withoutAge } = answers;

      const response = await submit(link.token, {
        answers: { ...withoutAge, goal: 'win', shoeSize: 43 },
      }).expect(422);

      expect(response.body.code).toBe('INVALID_INTAKE_ANSWERS');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          'age: required',
          'goal: invalid',
          'shoeSize: unknown',
        ]),
      );
      const still = await harness.as(session).get(`/clients/${client.id}`);
      expect(still.body.intakeStatus).toBe('pending');
      expect(
        await inWorkspace(workspaceId, () =>
          harness.tx.db
            .select()
            .from(measurements)
            .where(eq(measurements.clientId, client.id)),
        ),
      ).toEqual([]);
      await open(link.token).expect(200);
    });

    it('lets the client fix their answers and try again on the same link', async () => {
      const { link } = await ready();
      await submit(link.token, { answers: { ...answers, age: 5 } }).expect(422);

      await submit(link.token, { answers }).expect(201);
    });

    it.each([
      ['no body', undefined],
      ['no answers', {}],
      ['answers that are not an object', { answers: 'hello' }],
      ['a field next to the answers', { answers, status: 'submitted' }],
    ])('refuses %s', async (_label, body) => {
      const { link } = await ready();

      const response = await submit(link.token, body).expect(400);

      expect(response.body.code).toBe('VALIDATION_FAILED');
    });

    it('does not take answers for a token nobody has', async () => {
      const response = await submit('Zz9Zz9Zz', { answers }).expect(404);

      expect(response.body.code).toBe('INTAKE_LINK_NOT_FOUND');
    });

    it('does not take answers after the link has expired', async () => {
      const { link, workspaceId, client, session } = await ready();
      await inWorkspace(workspaceId, () =>
        harness.tx.db
          .update(intakeLinks)
          .set({ expiresAt: new Date(Date.now() - 1000) })
          .where(eq(intakeLinks.token, link.token)),
      );

      const response = await submit(link.token, { answers }).expect(410);

      expect(response.body.code).toBe('INTAKE_LINK_EXPIRED');
      const still = await harness.as(session).get(`/clients/${client.id}`);
      expect(still.body.intakeStatus).toBe('pending');
    });

    it('measures in pounds and inches for an imperial workspace', async () => {
      const { link, session, client, workspaceId } = await ready();
      await harness
        .as(session)
        .patch('/workspaces/current')
        .send({ unitSystem: 'imperial' })
        .expect(200);

      await submit(link.token, {
        answers: { ...answers, height: 70, weight: 180 },
      }).expect(201);

      const rows = await inWorkspace(workspaceId, () =>
        harness.tx.db
          .select({ metric: measurements.metric, unit: measurements.unit })
          .from(measurements)
          .where(eq(measurements.clientId, client.id)),
      );
      expect(rows).toEqual(
        expect.arrayContaining([
          { metric: 'weight', unit: 'lb' },
          { metric: 'height', unit: 'in' },
        ]),
      );
    });
  });

  describe('GET /clients/:id/intake: the coach reads the answers', () => {
    it('says there is nothing yet before the client has answered', async () => {
      const { session, client } = await ready();

      const response = await harness
        .as(session)
        .get(`/clients/${client.id}/intake`)
        .expect(404);

      expect(response.body.code).toBe('INTAKE_NOT_SUBMITTED');
    });

    it('shows the latest answers when the client has been asked again', async () => {
      const { link, session, client } = await ready();
      await submit(link.token, { answers }).expect(201);
      const reopened = await makeLink(session, client.id).expect(201);
      expect(reopened.body.token).not.toBe(link.token);
      await submit(reopened.body.token, {
        answers: { ...answers, weight: 79 },
      }).expect(201);

      const response = await harness
        .as(session)
        .get(`/clients/${client.id}/intake`)
        .expect(200);

      expect(response.body.answers.weight).toBe(79);
    });

    it('reopening gives a new link and leaves the old one closed', async () => {
      const { link, session, client } = await ready();
      await submit(link.token, { answers }).expect(201);

      const reopened = await makeLink(session, client.id).expect(201);

      expect(reopened.body.token).not.toBe(link.token);
      await open(link.token).expect(409);
      await open(reopened.body.token).expect(200);
    });

    it('does not exist for another coach’s client', async () => {
      const mine = await newCoach();
      const theirs = await ready();
      await submit(theirs.link.token, { answers }).expect(201);

      const response = await harness
        .as(mine.session)
        .get(`/clients/${theirs.client.id}/intake`)
        .expect(404);

      expect(response.body.code).toBe('CLIENT_NOT_FOUND');
    });

    it('tells a person with no workspace to create one first', async () => {
      const { session } = await harness.signedUpPerson();

      const response = await harness
        .as(session)
        .get(`/clients/${randomUUID()}/intake`)
        .expect(403);

      expect(response.body.code).toBe('NO_WORKSPACE');
    });
  });
});
