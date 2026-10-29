import { randomUUID } from 'node:crypto';
import { MuscleId } from '../src/exercises/enums/muscle-id.enum';
import { HttpTestApp, type TestSession } from './support/http-test-app';

jest.setTimeout(30_000);

describe('The exercise library over HTTP', () => {
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
      .send({ brandName: 'Library Gym' })
      .expect(201);
    harness.trackWorkspace(created.body.id);
    return { session, workspaceId: created.body.id as string };
  };

  type Item = {
    id: string;
    nameAr: string;
    nameEn: string;
    slug: string | null;
    equipment: string[];
    difficulty: string;
    pattern: string | null;
    cues: string[];
    mistakes: string[];
    videoUrl: string | null;
    isActive: boolean;
    isCustom: boolean;
    primaryMuscle: string | null;
    secondaryMuscles: string[];
  };

  const list = async (session: TestSession, query = '') =>
    (await harness.as(session).get(`/exercises?limit=100${query}`).expect(200))
      .body as { items: Item[]; total: number };

  const mine = {
    nameAr: 'تمرين خاص',
    nameEn: 'My special move',
    equipment: ['dumbbell'],
    difficulty: 'intermediate',
    pattern: 'pull',
    cues: ['One', 'Two', 'Three'],
    mistakes: ['Rushing'],
    videoUrl: 'https://www.youtube.com/watch?v=abc123',
    primaryMuscle: 'lats',
    secondaryMuscles: ['biceps'],
  };

  const create = (session: TestSession, body: Record<string, unknown>) =>
    harness.as(session).post('/exercises').send(body);

  describe('GET /muscles', () => {
    it('lists the twenty muscles of the anatomy drawing', async () => {
      const { session } = await newCoach();

      const response = await harness.as(session).get('/muscles').expect(200);

      expect(response.body).toHaveLength(20);
      // the table and the enum the API validates against must agree
      expect(
        response.body
          .map((m: { id: string }) => m.id)
          .sort((a: string, b: string) => a.localeCompare(b)),
      ).toEqual(
        Object.values(MuscleId).sort((a, b) =>
          String(a).localeCompare(String(b)),
        ),
      );
      expect(response.body).toContainEqual({
        id: 'chest',
        labelAr: 'صدر',
        labelEn: 'Chest',
        svgPathId: 'chest',
        bodySide: 'front',
      });
    });
  });

  describe('GET /exercises', () => {
    it('lists the library with each exercise’s muscles, cues and mistakes', async () => {
      const { session } = await newCoach();

      const { items, total } = await list(session);

      expect(total).toBeGreaterThanOrEqual(41);
      const bench = items.find((i) => i.slug === 'barbell-bench-press')!;
      expect(bench).toEqual({
        id: expect.any(String),
        nameAr: 'ضغط بنش بالبار',
        nameEn: 'Barbell bench press',
        slug: 'barbell-bench-press',
        equipment: ['barbell'],
        difficulty: 'intermediate',
        pattern: 'push',
        cues: expect.arrayContaining([expect.any(String)]),
        mistakes: expect.arrayContaining([expect.any(String)]),
        videoUrl: null,
        isActive: true,
        isCustom: false,
        primaryMuscle: 'chest',
        secondaryMuscles: expect.arrayContaining(['front_delts', 'triceps']),
      });
      expect(bench.cues).toHaveLength(3);
      expect(bench.mistakes).toHaveLength(2);
    });

    it('is paged, in name order', async () => {
      const { session } = await newCoach();

      const response = await harness
        .as(session)
        .get('/exercises?limit=5&page=2')
        .expect(200);

      expect(response.body).toMatchObject({
        page: 2,
        limit: 5,
        hasPrev: true,
        hasNext: true,
      });
      const names = response.body.items.map((i: Item) => i.nameEn);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });

    it('searches the English name', async () => {
      const { session } = await newCoach();

      const { items } = await list(session, '&q=bench');

      expect(items.map((i) => i.slug)).toContain('barbell-bench-press');
      expect(items.every((i) => /bench/i.test(i.nameEn))).toBe(true);
    });

    it('searches the Arabic name', async () => {
      const { session } = await newCoach();

      const { items } = await list(
        session,
        `&q=${encodeURIComponent('سكوات')}`,
      );

      expect(items.length).toBeGreaterThanOrEqual(2);
      expect(items.every((i) => i.nameAr.includes('سكوات'))).toBe(true);
    });

    it('takes the characters of a search literally, not as a pattern', async () => {
      const { session } = await newCoach();

      const { items } = await list(session, `&q=${encodeURIComponent('%')}`);

      expect(items).toEqual([]);
    });

    it('filters by equipment: anything that needs one of them', async () => {
      const { session } = await newCoach();

      const { items } = await list(session, '&equipment=bodyweight,bands');

      expect(items.length).toBeGreaterThan(5);
      for (const item of items) {
        expect(
          item.equipment.some((e) => ['bodyweight', 'bands'].includes(e)),
        ).toBe(true);
      }
    });

    it('filters by a muscle, primary or secondary', async () => {
      const { session } = await newCoach();

      const { items } = await list(session, '&muscle=biceps');

      const slugs = items.map((i) => i.slug);
      expect(slugs).toEqual(
        expect.arrayContaining(['barbell-curl', 'pull-up']),
      );
      expect(
        items.every(
          (i) =>
            i.primaryMuscle === 'biceps' ||
            i.secondaryMuscles.includes('biceps'),
        ),
      ).toBe(true);
    });

    it('filters by difficulty and by pattern', async () => {
      const { session } = await newCoach();

      const advanced = await list(session, '&difficulty=advanced');
      const cardio = await list(session, '&pattern=cardio');

      expect(advanced.items.length).toBeGreaterThan(0);
      expect(advanced.items.every((i) => i.difficulty === 'advanced')).toBe(
        true,
      );
      expect(
        cardio.items
          .map((i) => i.slug)
          .sort((a, b) => String(a).localeCompare(String(b))),
      ).toEqual(['jump-rope', 'treadmill-run']);
    });

    it.each([
      ['a difficulty nobody offers', '&difficulty=insane'],
      ['equipment nobody makes', '&equipment=laser'],
      ['a pattern nobody uses', '&pattern=dance'],
      ['an unknown muscle', '&muscle=wings'],
    ])('refuses %s', async (_label, query) => {
      const { session } = await newCoach();

      await harness.as(session).get(`/exercises?${query}`).expect(400);
    });
  });

  describe('POST /exercises', () => {
    it('adds an exercise of the coach’s own, which only they see', async () => {
      const coach = await newCoach();
      const other = await newCoach();

      const created = await create(coach.session, mine).expect(201);
      const seenByCoach = await list(coach.session, '&q=special');
      const seenByOther = await list(other.session, '&q=special');

      expect(created.body).toMatchObject({
        ...mine,
        slug: null,
        isActive: true,
        isCustom: true,
      });
      expect(seenByCoach.items.map((i) => i.id)).toEqual([created.body.id]);
      expect(seenByOther.items).toEqual([]);
    });

    it('needs only the names and a primary muscle', async () => {
      const { session } = await newCoach();

      const response = await create(session, {
        nameAr: 'تمرين',
        nameEn: 'Move',
        primaryMuscle: 'chest',
      }).expect(201);

      expect(response.body).toMatchObject({
        equipment: [],
        difficulty: 'beginner',
        pattern: null,
        cues: [],
        mistakes: [],
        videoUrl: null,
        secondaryMuscles: [],
      });
    });

    it('trims the names', async () => {
      const { session } = await newCoach();

      const response = await create(session, {
        nameAr: '  تمرين  ',
        nameEn: '  Move  ',
        primaryMuscle: 'chest',
      }).expect(201);

      expect(response.body).toMatchObject({ nameAr: 'تمرين', nameEn: 'Move' });
    });

    it('refuses a muscle that is not on the drawing', async () => {
      const { session } = await newCoach();

      await create(session, { ...mine, primaryMuscle: 'wings' }).expect(400);
    });

    it('refuses the primary muscle listed again as a secondary one', async () => {
      const { session } = await newCoach();

      const response = await create(session, {
        ...mine,
        primaryMuscle: 'lats',
        secondaryMuscles: ['lats'],
      }).expect(422);

      expect(response.body.code).toBe('MUSCLE_LISTED_TWICE');
    });

    it.each([
      ['no Arabic name', { nameAr: undefined }],
      ['no English name', { nameEn: undefined }],
      ['a blank name', { nameEn: '   ' }],
      ['a name over 120 characters', { nameEn: 'x'.repeat(121) }],
      ['no primary muscle', { primaryMuscle: undefined }],
      ['equipment nobody makes', { equipment: ['laser'] }],
      ['the same equipment twice', { equipment: ['dumbbell', 'dumbbell'] }],
      ['a difficulty nobody offers', { difficulty: 'insane' }],
      ['more than five cues', { cues: ['1', '2', '3', '4', '5', '6'] }],
      ['a cue over 200 characters', { cues: ['x'.repeat(201)] }],
      [
        'a video that is not a YouTube link',
        { videoUrl: 'https://evil.example/v' },
      ],
      ['a video that is not a link at all', { videoUrl: 'watch this' }],
    ])('refuses %s', async (_label, change) => {
      const { session } = await newCoach();

      await create(session, { ...mine, ...change }).expect(400);
    });

    it.each([
      'https://www.youtube.com/watch?v=abc123',
      'https://youtu.be/abc123',
      'https://m.youtube.com/watch?v=abc123',
    ])('accepts the YouTube link %s', async (videoUrl) => {
      const { session } = await newCoach();

      const response = await create(session, { ...mine, videoUrl }).expect(201);

      expect(response.body.videoUrl).toBe(videoUrl);
    });
  });

  describe('GET and PATCH /exercises/:id', () => {
    it('shows a library exercise and a custom one', async () => {
      const { session } = await newCoach();
      const custom = await create(session, mine).expect(201);
      const library = (await list(session, '&q=plank')).items[0];

      const one = await harness
        .as(session)
        .get(`/exercises/${custom.body.id}`)
        .expect(200);
      const global = await harness
        .as(session)
        .get(`/exercises/${library.id}`)
        .expect(200);

      expect(one.body).toEqual(custom.body);
      expect(global.body).toEqual(library);
    });

    it('is not found for an id that is not there, and refuses one that is not an id', async () => {
      const { session } = await newCoach();

      const missing = await harness
        .as(session)
        .get(`/exercises/${randomUUID()}`)
        .expect(404);
      await harness.as(session).get('/exercises/nope').expect(400);

      expect(missing.body.code).toBe('EXERCISE_NOT_FOUND');
    });

    it('changes what was sent and leaves the rest', async () => {
      const { session } = await newCoach();
      const custom = await create(session, mine).expect(201);

      const response = await harness
        .as(session)
        .patch(`/exercises/${custom.body.id}`)
        .send({ nameEn: 'Renamed', cues: ['Only one'] })
        .expect(200);

      expect(response.body).toMatchObject({
        ...mine,
        nameEn: 'Renamed',
        cues: ['Only one'],
      });
    });

    it('changes the muscles together', async () => {
      const { session } = await newCoach();
      const custom = await create(session, mine).expect(201);

      const response = await harness
        .as(session)
        .patch(`/exercises/${custom.body.id}`)
        .send({ primaryMuscle: 'chest', secondaryMuscles: ['triceps', 'abs'] })
        .expect(200);

      expect(response.body).toMatchObject({
        primaryMuscle: 'chest',
        secondaryMuscles: expect.arrayContaining(['triceps', 'abs']),
      });
      expect(response.body.secondaryMuscles).toHaveLength(2);
    });

    it('clears a video with null', async () => {
      const { session } = await newCoach();
      const custom = await create(session, mine).expect(201);

      const response = await harness
        .as(session)
        .patch(`/exercises/${custom.body.id}`)
        .send({ videoUrl: null })
        .expect(200);

      expect(response.body.videoUrl).toBeNull();
    });

    it('is never deleted, only deactivated: it leaves the list but can still be read', async () => {
      const { session } = await newCoach();
      const custom = await create(session, mine).expect(201);

      await harness
        .as(session)
        .patch(`/exercises/${custom.body.id}`)
        .send({ isActive: false })
        .expect(200);
      const hidden = await list(session, '&q=special');
      const shown = await list(session, '&q=special&includeInactive=true');
      const read = await harness
        .as(session)
        .get(`/exercises/${custom.body.id}`)
        .expect(200);

      expect(hidden.items).toEqual([]);
      expect(shown.items.map((i) => i.id)).toEqual([custom.body.id]);
      expect(read.body.isActive).toBe(false);
    });

    it('does not let a library exercise be changed', async () => {
      const { session } = await newCoach();
      const library = (await list(session, '&q=plank')).items[0];

      const response = await harness
        .as(session)
        .patch(`/exercises/${library.id}`)
        .send({ nameEn: 'Hacked' })
        .expect(403);

      expect(response.body.code).toBe('EXERCISE_NOT_EDITABLE');
    });

    it('does not reach another coach’s exercise', async () => {
      const coach = await newCoach();
      const other = await newCoach();
      const custom = await create(coach.session, mine).expect(201);

      await harness
        .as(other.session)
        .get(`/exercises/${custom.body.id}`)
        .expect(404);
      await harness
        .as(other.session)
        .patch(`/exercises/${custom.body.id}`)
        .send({ nameEn: 'Mine now' })
        .expect(404);
    });

    it('refuses an unknown muscle on a change', async () => {
      const { session } = await newCoach();
      const custom = await create(session, mine).expect(201);

      await harness
        .as(session)
        .patch(`/exercises/${custom.body.id}`)
        .send({ secondaryMuscles: ['wings'] })
        .expect(400);
    });
  });
});
