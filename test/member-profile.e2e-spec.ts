import { HttpTestApp, type TestSession } from './support/http-test-app';

describe('A coach’s own profile over HTTP', () => {
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
      .send({ brandName: 'Profile Gym' })
      .expect(201);
    harness.trackWorkspace(created.body.id);
    return { session, workspaceId: created.body.id as string };
  };

  const read = (session: TestSession) => harness.as(session).get('/members/me');
  const change = (session: TestSession, body: Record<string, unknown>) =>
    harness.as(session).patch('/members/me').send(body);

  describe('GET /members/me', () => {
    it('starts empty', async () => {
      const { session } = await newCoach();

      const response = await read(session).expect(200);

      expect(response.body).toEqual({
        specialties: [],
        bio: null,
        instagram: null,
      });
    });

    it('tells a person with no workspace to create one first', async () => {
      const { session } = await harness.signedUpPerson();

      const response = await read(session).expect(403);

      expect(response.body.code).toBe('NO_WORKSPACE');
    });

    it('needs a token', async () => {
      await harness.server().get('/api/v1/members/me').expect(401);
    });
  });

  describe('PATCH /members/me', () => {
    it('sets the specialties, the bio and the Instagram account', async () => {
      const { session } = await newCoach();

      const response = await change(session, {
        specialties: ['fat_loss', 'womens_training'],
        bio: '  Ten years of coaching.  ',
        instagram: 'sara.fit',
      }).expect(200);

      expect(response.body).toEqual({
        specialties: ['fat_loss', 'womens_training'],
        bio: 'Ten years of coaching.',
        instagram: 'sara.fit',
      });
      expect((await read(session)).body).toEqual(response.body);
    });

    it('accepts every specialty the product offers', async () => {
      const { session } = await newCoach();
      const all = [
        'fat_loss',
        'muscle_gain',
        'injury_rehab',
        'womens_training',
        'sport_specific',
      ];

      const response = await change(session, { specialties: all }).expect(200);

      expect(response.body.specialties).toEqual(all);
    });

    it('writes the Instagram account without the @', async () => {
      const { session } = await newCoach();

      const response = await change(session, { instagram: '@sara.fit' }).expect(
        200,
      );

      expect(response.body.instagram).toBe('sara.fit');
    });

    it('changes only what was sent', async () => {
      const { session } = await newCoach();
      await change(session, {
        specialties: ['muscle_gain'],
        bio: 'Strength coach',
        instagram: 'strong.coach',
      }).expect(200);

      const response = await change(session, {
        bio: 'Now with nutrition',
      }).expect(200);

      expect(response.body).toEqual({
        specialties: ['muscle_gain'],
        bio: 'Now with nutrition',
        instagram: 'strong.coach',
      });
    });

    it('clears a field when it is sent as null, and the specialties when sent empty', async () => {
      const { session } = await newCoach();
      await change(session, {
        specialties: ['fat_loss'],
        bio: 'Something',
        instagram: 'someone',
      }).expect(200);

      const response = await change(session, {
        specialties: [],
        bio: null,
        instagram: null,
      }).expect(200);

      expect(response.body).toEqual({
        specialties: [],
        bio: null,
        instagram: null,
      });
    });

    it('changes nothing when nothing is sent', async () => {
      const { session } = await newCoach();
      await change(session, { bio: 'Keep me' }).expect(200);

      const response = await change(session, {}).expect(200);

      expect(response.body.bio).toBe('Keep me');
    });

    it('keeps each coach’s profile to themselves', async () => {
      const first = await newCoach();
      const second = await newCoach();

      await change(first.session, { bio: 'First coach only' }).expect(200);

      expect((await read(second.session)).body.bio).toBeNull();
    });

    it.each([
      ['a specialty that is not offered', { specialties: ['yoga'] }],
      ['a specialty twice', { specialties: ['fat_loss', 'fat_loss'] }],
      ['specialties that are not a list', { specialties: 'fat_loss' }],
      ['a bio over 500 characters', { bio: 'x'.repeat(501) }],
      ['a bio that is not text', { bio: 42 }],
      ['an Instagram account with a space in it', { instagram: 'sara fit' }],
      [
        'an Instagram account over 30 characters',
        { instagram: 'x'.repeat(31) },
      ],
      ['an Instagram account that is only an @', { instagram: '@' }],
      ['a role', { role: 'assistant' }],
      ['ownership', { isOwner: false }],
      ['another person', { personId: '00000000-0000-4000-8000-000000000000' }],
    ])('refuses %s', async (_label, body) => {
      const { session } = await newCoach();

      const response = await change(session, body).expect(400);

      expect(response.body.code).toBe('VALIDATION_FAILED');
    });

    it('tells a person with no workspace to create one first', async () => {
      const { session } = await harness.signedUpPerson();

      const response = await change(session, { bio: 'x' }).expect(403);

      expect(response.body.code).toBe('NO_WORKSPACE');
    });
  });
});
