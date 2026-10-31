import { HttpTestApp, type TestSession } from './support/http-test-app';

// a flow here registers a coach, a workspace and a client before it starts; against the hosted database that outlasts 5 seconds
jest.setTimeout(60_000);

describe('Program links over HTTP', () => {
  let harness: HttpTestApp;
  let benchPressId: string;

  beforeAll(async () => {
    harness = await HttpTestApp.start();
    const { session } = await newCoach();
    const library = await harness
      .as(session)
      .get('/exercises?limit=100')
      .expect(200);
    benchPressId = library.body.items.find(
      (e: { slug: string }) => e.slug === 'barbell-bench-press',
    ).id;
  });

  afterAll(() => harness.stop(), 60_000);

  const PASSWORD = 'correct horse battery';

  const newCoach = async (brandName = 'Program Gym') => {
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
    harness.as(session).post(`/clients/${clientId}/program-link`);

  const gate = (token: string) =>
    harness.server().get(`/api/v1/program/${token}/gate`);
  const claim = (token: string, body: unknown) =>
    harness
      .server()
      .post(`/api/v1/program/${token}/claim`)
      .send(body as object);
  const login = (token: string, body: unknown) =>
    harness
      .server()
      .post(`/api/v1/program/${token}/login`)
      .send(body as object);
  const program = (token: string, session?: string) => {
    const call = harness.server().get(`/api/v1/program/${token}`);
    return session ? call.set('x-program-session', session) : call;
  };

  /** A coach, one client and their program link, ready to be opened. */
  const ready = async (brandName?: string) => {
    const coach = await newCoach(brandName);
    const client = await newClient(coach.session);
    const link = (await makeLink(coach.session, client.id).expect(200))
      .body as { token: string; url: string; hasPassword: boolean };
    return { ...coach, client, link };
  };

  /** Ready, with the client's password chosen and a session in hand. */
  const signedIn = async () => {
    const base = await ready();
    const claimed = await claim(base.link.token, {
      phone: base.client.phone,
      password: PASSWORD,
    }).expect(200);
    return { ...base, programSession: claimed.body.session as string };
  };

  const activePlan = async (session: TestSession, clientId: string) => {
    const plan = (
      await harness
        .as(session)
        .post('/plans')
        .send({ name: 'Strength block', clientId, notes: 'PRIVATE COACH NOTE' })
        .expect(201)
    ).body as { id: string };
    await harness
      .as(session)
      .put(`/plans/${plan.id}/days`)
      .send({
        days: [
          {
            weekNo: 1,
            dayNo: 1,
            name: 'Chest',
            notes: 'Warm up first',
            exercises: [
              {
                exerciseId: benchPressId,
                coachNote: 'Slow down',
                sets: [{ reps: '8-10', weightKg: 60, restSeconds: 90, rir: 2 }],
              },
            ],
          },
        ],
      })
      .expect(200);
    await harness.as(session).post(`/plans/${plan.id}/activate`).expect(201);
    return plan.id;
  };

  describe('POST /clients/:id/program-link: the coach gets the link', () => {
    it('makes a 12 character link that reads with the coach handle, and no password yet', async () => {
      const { link } = await ready();

      expect(link).toEqual({
        token: expect.stringMatching(/^[A-Za-z0-9]{12}$/),
        url: expect.stringMatching(
          /^http:\/\/localhost:3001\/program\/[a-z0-9-]+\/[A-Za-z0-9]{12}$/,
        ),
        hasPassword: false,
      });
      expect(link.url.endsWith(`/${link.token}`)).toBe(true);
    });

    it('gives the same link back every time: a client has one, for good', async () => {
      const { session, client, link } = await ready();

      const again = await makeLink(session, client.id).expect(200);

      expect(again.body).toEqual(link);
    });

    it('is not available for another coach’s client', async () => {
      const { client } = await ready();
      const stranger = await newCoach('Someone Else');

      await makeLink(stranger.session, client.id).expect(404);
    });
  });

  describe('GET /program/:token/gate: before anyone signs in', () => {
    it('shows the brand, the first name and whether a password was chosen, and nothing else', async () => {
      const { client, link } = await ready('Gate Gym');

      const response = await gate(link.token).expect(200);

      expect(response.body).toEqual({
        coach: { brandName: 'Gate Gym', logoUrl: null },
        client: { firstName: 'Omar' },
        hasPassword: false,
      });
      const text = JSON.stringify(response.body);
      expect(text).not.toContain(client.phone);
      expect(text).not.toContain(client.id);
    });

    it('is a 404 for a token that is not a link, and a 400 for one that cannot be', async () => {
      const response = await gate('AAAAAAAAAAAA').expect(404);

      expect(response.body.code).toBe('PROGRAM_LINK_NOT_FOUND');
      await Promise.all(
        ['short', 'waytoolongtokenvalue', 'bad-char!!!'].map((bad) =>
          gate(bad).expect(400),
        ),
      );
    });
  });

  describe('POST /program/:token/claim: the first visit', () => {
    it('chooses the password with the right mobile number and signs the device in for 30 days', async () => {
      const { client, link } = await ready();

      const response = await claim(link.token, {
        phone: client.phone,
        password: PASSWORD,
      }).expect(200);

      expect(response.body.session).toMatch(/^v1\.[\w-]+\.[\w-]+$/);
      const days =
        (new Date(response.body.expiresAt).getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(29.9);
      expect(days).toBeLessThan(30.1);
      expect((await gate(link.token)).body.hasPassword).toBe(true);
    });

    it('refuses a number that is not the client’s, without saying that was the problem', async () => {
      const { link } = await ready();

      const response = await claim(link.token, {
        phone: harness.uniquePhone(),
        password: PASSWORD,
      }).expect(401);

      expect(response.body.code).toBe('PROGRAM_CREDENTIALS_INVALID');
      expect((await gate(link.token)).body.hasPassword).toBe(false);
    });

    it('refuses a second first visit, and a password that is too short', async () => {
      const { client, link } = await ready();
      await claim(link.token, {
        phone: client.phone,
        password: 'short',
      }).expect(400);
      await claim(link.token, {
        phone: client.phone,
        password: PASSWORD,
      }).expect(200);

      const again = await claim(link.token, {
        phone: client.phone,
        password: 'another password',
      }).expect(409);

      expect(again.body.code).toBe('PROGRAM_ALREADY_CLAIMED');
    });
  });

  describe('POST /program/:token/login: later visits', () => {
    it('signs in with the number and the password', async () => {
      const { client, link } = await signedIn();

      const response = await login(link.token, {
        phone: client.phone,
        password: PASSWORD,
      }).expect(200);

      expect(response.body.session).toMatch(/^v1\./);
    });

    it('gives the same refusal for a wrong password and a wrong number', async () => {
      const { client, link } = await signedIn();

      const wrongPassword = await login(link.token, {
        phone: client.phone,
        password: 'not the password',
      }).expect(401);
      const wrongPhone = await login(link.token, {
        phone: harness.uniquePhone(),
        password: PASSWORD,
      }).expect(401);

      expect(wrongPassword.body.code).toBe('PROGRAM_CREDENTIALS_INVALID');
      expect(wrongPhone.body.code).toBe(wrongPassword.body.code);
      expect(wrongPhone.body.message).toBe(wrongPassword.body.message);
    });

    it('stops listening after five wrong tries, even for the right password', async () => {
      const { client, link } = await signedIn();
      // Attempts must remain sequential to exercise the lockout threshold.
      await Array.from({ length: 5 }).reduce<Promise<void>>(
        (previous) =>
          previous.then(async () => {
            await login(link.token, {
              phone: client.phone,
              password: 'not the password',
            }).expect(401);
          }),
        Promise.resolve(),
      );

      const locked = await login(link.token, {
        phone: client.phone,
        password: PASSWORD,
      }).expect(429);

      expect(locked.body.code).toBe('PROGRAM_LOCKED');
    });
  });

  describe('GET /program/:token: the program itself', () => {
    it('needs a session', async () => {
      const { link } = await signedIn();

      const response = await program(link.token).expect(401);

      expect(response.body.code).toBe('PROGRAM_SESSION_REQUIRED');
    });

    it('refuses a session that was altered, or that belongs to another link', async () => {
      const first = await signedIn();
      const second = await signedIn();
      const [version, payload, signature] = first.programSession.split('.');
      const forged = `${version}.${Buffer.from(
        JSON.stringify({ l: 'x', w: 'y', v: 1, e: 9999999999 }),
      ).toString('base64url')}.${signature}`;

      await program(first.link.token, forged).expect(401);
      await program(first.link.token, `${version}.${payload}.AAAA`).expect(401);
      await program(first.link.token, second.programSession).expect(401);
      await program(first.link.token, 'not a session').expect(401);
    });

    it('has a workout of null while the client follows no plan, and keeps the nutrition place reserved', async () => {
      const { link, programSession } = await signedIn();

      const response = await program(link.token, programSession).expect(200);

      expect(response.body).toEqual({
        coach: { brandName: 'Program Gym', logoUrl: null },
        client: { firstName: 'Omar' },
        workout: null,
        nutrition: null,
      });
    });

    it('shows the active plan in full, with no ids and not the coach’s private notes', async () => {
      const { session, client, link, workspaceId, programSession } =
        await signedIn();
      const planId = await activePlan(session, client.id);

      const response = await program(link.token, programSession).expect(200);

      expect(response.body.workout).toMatchObject({
        name: 'Strength block',
        weeks: expect.any(Number),
        days: [
          {
            weekNo: 1,
            dayNo: 1,
            name: 'Chest',
            notes: 'Warm up first',
            exercises: [
              {
                coachNote: 'Slow down',
                sets: [
                  {
                    setNo: 1,
                    reps: '8-10',
                    weightKg: 60,
                    restSeconds: 90,
                    rir: 2,
                  },
                ],
              },
            ],
          },
        ],
      });
      const text = JSON.stringify(response.body);
      for (const secret of [
        client.phone,
        client.id,
        workspaceId,
        planId,
        benchPressId,
        'PRIVATE COACH NOTE',
      ]) {
        expect(text).not.toContain(secret);
      }
    });

    it('follows the plan the client has now: a new one replaces the old one on the same link', async () => {
      const { session, client, link, programSession } = await signedIn();
      await activePlan(session, client.id);
      const next = (
        await harness
          .as(session)
          .post('/plans')
          .send({ name: 'Next block', clientId: client.id })
          .expect(201)
      ).body as { id: string };
      await harness.as(session).post(`/plans/${next.id}/activate`).expect(201);

      const response = await program(link.token, programSession).expect(200);

      expect(response.body.workout.name).toBe('Next block');
    });

    it('is a 404 once the client has been removed', async () => {
      const { session, client, link, programSession } = await signedIn();
      await harness.as(session).delete(`/clients/${client.id}`).expect(204);

      await program(link.token, programSession).expect(404);
      await gate(link.token).expect(404);
    });
  });

  describe('resetting access and making a new link', () => {
    it('reset access signs every device out and lets the client choose a new password on the same link', async () => {
      const { session, client, link, programSession } = await signedIn();
      await program(link.token, programSession).expect(200);

      const reset = await harness
        .as(session)
        .post(`/clients/${client.id}/program-link/reset-access`)
        .expect(200);

      expect(reset.body).toEqual({ ...link, hasPassword: false });
      await program(link.token, programSession).expect(401);
      await login(link.token, {
        phone: client.phone,
        password: PASSWORD,
      }).expect(401);
      const again = await claim(link.token, {
        phone: client.phone,
        password: 'a brand new password',
      }).expect(200);
      await program(link.token, again.body.session).expect(200);
      // a session from before the reset stays void even after the new password
      await program(link.token, programSession).expect(401);
    });

    it('a new link kills the old address, and asks for a password again', async () => {
      const { session, client, link, programSession } = await signedIn();

      const rotated = await harness
        .as(session)
        .post(`/clients/${client.id}/program-link/rotate`)
        .expect(200);

      expect(rotated.body.token).not.toBe(link.token);
      expect(rotated.body.hasPassword).toBe(false);
      await gate(link.token).expect(404);
      await program(link.token, programSession).expect(404);
      await claim(rotated.body.token, {
        phone: client.phone,
        password: PASSWORD,
      }).expect(200);
    });

    it('cannot reset a link that was never made', async () => {
      const coach = await newCoach();
      const client = await newClient(coach.session);

      await harness
        .as(coach.session)
        .post(`/clients/${client.id}/program-link/reset-access`)
        .expect(404);
    });
  });
});
