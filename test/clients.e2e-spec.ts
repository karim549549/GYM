import { randomUUID } from 'node:crypto';
import { HttpTestApp, type TestSession } from './support/http-test-app';

describe('Clients over HTTP', () => {
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
      .send({ brandName: 'Clients Gym' })
      .expect(201);
    harness.trackWorkspace(created.body.id);
    return { session, workspaceId: created.body.id as string };
  };

  const add = (session: TestSession, body: Record<string, unknown>) =>
    harness.as(session).post('/clients').send(body);

  const person = (name = 'Omar Khaled') => ({
    fullName: name,
    phone: harness.uniquePhone(),
  });

  const list = (session: TestSession, query = '') =>
    harness.as(session).get(`/clients${query}`);

  const added = async (session: TestSession, body = person()) =>
    (await add(session, body).expect(201)).body;

  describe('POST /clients', () => {
    it('adds a client to the workspace, waiting to fill in their details', async () => {
      const { session } = await newCoach();
      const body = person('Omar Khaled');

      const response = await add(session, body).expect(201);

      expect(response.body).toEqual({
        id: expect.any(String),
        fullName: 'Omar Khaled',
        phone: body.phone,
        intakeStatus: 'pending',
        personId: null,
        createdAt: expect.any(String),
      });
    });

    it('keeps a number typed the local way in international form, and trims the name', async () => {
      const { session } = await newCoach();
      const international = harness.uniquePhone();
      const local = `0${international.slice(3)}`;

      const response = await add(session, {
        fullName: '  Nour Adel  ',
        phone: local,
      }).expect(201);

      expect(response.body).toMatchObject({
        fullName: 'Nour Adel',
        phone: international,
      });
    });

    it('links the client to the person who already signed up with that number', async () => {
      const { session } = await newCoach();
      const signedUp = await harness.signedUpPerson({
        fullName: 'Already Here',
      });
      const personId = (await harness.me(signedUp.session.accessToken)).body
        .personId;

      const response = await add(session, {
        fullName: 'Already Here',
        phone: signedUp.body.phone,
      }).expect(201);

      expect(response.body.personId).toBe(personId);
    });

    it('refuses a client the workspace already has', async () => {
      const { session } = await newCoach();
      const body = person();
      await add(session, body).expect(201);

      const again = await add(session, { ...body, fullName: 'Someone Else' });

      expect(again.status).toBe(409);
      expect(again.body.code).toBe('CLIENT_ALREADY_EXISTS');
    });

    it('lets two coaches have the same person as a client', async () => {
      const first = await newCoach();
      const second = await newCoach();
      const body = person();

      await add(first.session, body).expect(201);
      await add(second.session, body).expect(201);
    });

    it('brings back a client who was removed, instead of making a second one', async () => {
      const { session } = await newCoach();
      const body = person('Removed Then Back');
      const original = await added(session, body);
      await harness.as(session).delete(`/clients/${original.id}`).expect(204);

      const again = await add(session, {
        ...body,
        fullName: 'Back Again',
      }).expect(201);

      expect(again.body.id).toBe(original.id);
      expect(again.body.fullName).toBe('Back Again');
      const ids = (await list(session)).body.items.map(
        (c: { id: string }) => c.id,
      );
      expect(ids).toContain(original.id);
    });

    it.each([
      ['no name', { phone: '01012345678' }],
      ['a blank name', { fullName: '   ', phone: '01012345678' }],
      [
        'a name that is too long',
        { fullName: 'x'.repeat(121), phone: '01012345678' },
      ],
      ['no phone', { fullName: 'Omar' }],
      ['a phone that is not a number', { fullName: 'Omar', phone: 'call me' }],
      [
        'a status of their own choosing',
        { fullName: 'Omar', phone: '01012345678', intakeStatus: 'submitted' },
      ],
      [
        'another workspace',
        { fullName: 'Omar', phone: '01012345678', workspaceId: randomUUID() },
      ],
    ])('refuses %s', async (_label, body) => {
      const { session } = await newCoach();

      const response = await add(session, body).expect(400);

      expect(response.body.code).toBe('VALIDATION_FAILED');
    });

    it('tells a person with no workspace to create one first', async () => {
      const { session } = await harness.signedUpPerson();

      const response = await add(session, person()).expect(403);

      expect(response.body.code).toBe('NO_WORKSPACE');
    });

    it('needs a token', async () => {
      await harness.server().post('/api/v1/clients').send(person()).expect(401);
    });
  });

  describe('GET /clients', () => {
    it('lists the workspace’s clients a page at a time, newest first', async () => {
      const { session } = await newCoach();
      const first = await added(session, person('First'));
      const second = await added(session, person('Second'));
      const third = await added(session, person('Third'));

      const page1 = await list(session, '?limit=2').expect(200);
      const page2 = await list(session, '?limit=2&page=2').expect(200);

      expect(page1.body).toMatchObject({
        total: 3,
        page: 1,
        limit: 2,
        totalPages: 2,
        hasNext: true,
        hasPrev: false,
      });
      expect(page1.body.items.map((c: { id: string }) => c.id)).toEqual([
        third.id,
        second.id,
      ]);
      expect(page2.body).toMatchObject({
        page: 2,
        hasNext: false,
        hasPrev: true,
      });
      expect(page2.body.items.map((c: { id: string }) => c.id)).toEqual([
        first.id,
      ]);
    });

    it('is empty for a coach with no clients', async () => {
      const { session } = await newCoach();

      const response = await list(session).expect(200);

      expect(response.body).toEqual({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      });
    });

    it('shows what is known of each client: no subscription, plan or check-ins yet for a new one', async () => {
      const { session } = await newCoach();
      await added(session, person('Fresh'));

      const response = await list(session).expect(200);

      expect(response.body.items[0].summary).toEqual({
        subscription: null,
        hasPlan: false,
        nextCheckinInDays: null,
        missedCheckins: 0,
      });
    });

    it('leaves out clients who were removed', async () => {
      const { session } = await newCoach();
      const kept = await added(session, person('Kept'));
      const gone = await added(session, person('Gone'));
      await harness.as(session).delete(`/clients/${gone.id}`).expect(204);

      const response = await list(session).expect(200);

      expect(response.body.total).toBe(1);
      expect(response.body.items.map((c: { id: string }) => c.id)).toEqual([
        kept.id,
      ]);
    });

    it('shows only this coach’s clients', async () => {
      const mine = await newCoach();
      const theirs = await newCoach();
      await added(mine.session, person('Mine'));
      await added(theirs.session, person('Theirs'));

      const response = await list(mine.session).expect(200);

      expect(
        response.body.items.map((c: { fullName: string }) => c.fullName),
      ).toEqual(['Mine']);
    });

    it('can be narrowed to those who have not filled in their details', async () => {
      const { session } = await newCoach();
      await added(session, person('Waiting'));

      const waiting = await list(session, '?status=pending').expect(200);
      const done = await list(session, '?status=submitted').expect(200);

      expect(waiting.body.total).toBe(1);
      expect(done.body.total).toBe(0);
    });

    it('can be searched by name or by part of a number', async () => {
      const { session } = await newCoach();
      const sara = await added(session, person('Sara Mostafa'));
      await added(session, person('Karim Hassan'));

      const byName = await list(session, '?search=mostafa').expect(200);
      const byNumber = await list(
        session,
        `?search=${encodeURIComponent(sara.phone.slice(-6))}`,
      ).expect(200);

      expect(byName.body.items.map((c: { id: string }) => c.id)).toEqual([
        sara.id,
      ]);
      expect(byNumber.body.items.map((c: { id: string }) => c.id)).toEqual([
        sara.id,
      ]);
    });

    it('treats the characters of a pattern in a search as plain text', async () => {
      const { session } = await newCoach();
      await added(session, person('Plain Name'));

      const response = await list(
        session,
        `?search=${encodeURIComponent('%')}`,
      ).expect(200);

      expect(response.body.total).toBe(0);
    });

    it.each([
      ['a page of zero', '?page=0'],
      ['a page that is not a number', '?page=two'],
      ['a limit of zero', '?limit=0'],
      ['a limit over 100', '?limit=101'],
      ['a status that does not exist', '?status=maybe'],
      ['a search that is too long', `?search=${'x'.repeat(81)}`],
      ['something it does not know', '?sort=name'],
    ])('refuses %s', async (_label, query) => {
      const { session } = await newCoach();

      const response = await list(session, query).expect(400);

      expect(response.body.code).toBe('VALIDATION_FAILED');
    });

    it('tells a person with no workspace to create one first', async () => {
      const { session } = await harness.signedUpPerson();

      const response = await list(session).expect(403);

      expect(response.body.code).toBe('NO_WORKSPACE');
    });
  });

  describe('GET /clients/:id', () => {
    it('shows the client', async () => {
      const { session } = await newCoach();
      const client = await added(session);

      const response = await harness
        .as(session)
        .get(`/clients/${client.id}`)
        .expect(200);

      expect(response.body).toEqual(client);
    });

    it('does not exist for an id nobody has', async () => {
      const { session } = await newCoach();

      const response = await harness
        .as(session)
        .get(`/clients/${randomUUID()}`)
        .expect(404);

      expect(response.body.code).toBe('CLIENT_NOT_FOUND');
    });

    it('does not exist for another coach’s client', async () => {
      const mine = await newCoach();
      const theirs = await newCoach();
      const client = await added(theirs.session);

      const response = await harness
        .as(mine.session)
        .get(`/clients/${client.id}`)
        .expect(404);

      expect(response.body.code).toBe('CLIENT_NOT_FOUND');
    });

    it('does not exist once removed', async () => {
      const { session } = await newCoach();
      const client = await added(session);
      await harness.as(session).delete(`/clients/${client.id}`).expect(204);

      await harness.as(session).get(`/clients/${client.id}`).expect(404);
    });

    it('refuses an id that is not an id', async () => {
      const { session } = await newCoach();

      const response = await harness
        .as(session)
        .get('/clients/not-an-id')
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('PATCH /clients/:id', () => {
    it('changes the name', async () => {
      const { session } = await newCoach();
      const client = await added(session, person('Before'));

      const response = await harness
        .as(session)
        .patch(`/clients/${client.id}`)
        .send({ fullName: '  After  ' })
        .expect(200);

      expect(response.body).toEqual({ ...client, fullName: 'After' });
    });

    it('changes the number, and the link to a person follows the new number', async () => {
      const { session } = await newCoach();
      const client = await added(session);
      const signedUp = await harness.signedUpPerson();
      const personId = (await harness.me(signedUp.session.accessToken)).body
        .personId;

      const response = await harness
        .as(session)
        .patch(`/clients/${client.id}`)
        .send({ phone: signedUp.body.phone })
        .expect(200);

      expect(response.body).toMatchObject({
        phone: signedUp.body.phone,
        personId,
      });
    });

    it('changes nothing when nothing is sent', async () => {
      const { session } = await newCoach();
      const client = await added(session);

      const response = await harness
        .as(session)
        .patch(`/clients/${client.id}`)
        .send({})
        .expect(200);

      expect(response.body).toEqual(client);
    });

    it('refuses a number another client of this coach already has', async () => {
      const { session } = await newCoach();
      const first = await added(session);
      const second = await added(session);

      const response = await harness
        .as(session)
        .patch(`/clients/${second.id}`)
        .send({ phone: first.phone })
        .expect(409);

      expect(response.body.code).toBe('CLIENT_ALREADY_EXISTS');
    });

    it('cannot reach another coach’s client', async () => {
      const mine = await newCoach();
      const theirs = await newCoach();
      const client = await added(theirs.session, person('Theirs'));

      await harness
        .as(mine.session)
        .patch(`/clients/${client.id}`)
        .send({ fullName: 'Taken Over' })
        .expect(404);

      const unchanged = await harness
        .as(theirs.session)
        .get(`/clients/${client.id}`);
      expect(unchanged.body.fullName).toBe('Theirs');
    });

    it.each([
      ['a blank name', { fullName: '   ' }],
      ['a phone that is not a number', { phone: 'nope' }],
      ['their status', { intakeStatus: 'submitted' }],
      ['their link to a person', { personId: randomUUID() }],
      ['an id', { id: randomUUID() }],
    ])('refuses %s', async (_label, body) => {
      const { session } = await newCoach();
      const client = await added(session);

      const response = await harness
        .as(session)
        .patch(`/clients/${client.id}`)
        .send(body)
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('DELETE /clients/:id', () => {
    it('removes the client from the list without destroying the row', async () => {
      const { session } = await newCoach();
      const client = await added(session);

      await harness.as(session).delete(`/clients/${client.id}`).expect(204);

      expect((await list(session)).body.total).toBe(0);
    });

    it('says the client does not exist the second time', async () => {
      const { session } = await newCoach();
      const client = await added(session);
      await harness.as(session).delete(`/clients/${client.id}`).expect(204);

      const again = await harness
        .as(session)
        .delete(`/clients/${client.id}`)
        .expect(404);

      expect(again.body.code).toBe('CLIENT_NOT_FOUND');
    });

    it('cannot remove another coach’s client', async () => {
      const mine = await newCoach();
      const theirs = await newCoach();
      const client = await added(theirs.session);

      await harness
        .as(mine.session)
        .delete(`/clients/${client.id}`)
        .expect(404);

      await harness.as(theirs.session).get(`/clients/${client.id}`).expect(200);
    });

    it('needs a token', async () => {
      await harness
        .server()
        .delete(`/api/v1/clients/${randomUUID()}`)
        .expect(401);
    });
  });
});
