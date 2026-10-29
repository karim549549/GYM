import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { HttpTestApp } from './support/http-test-app';

describe('Managing a workspace over HTTP', () => {
  let harness: HttpTestApp;

  beforeAll(async () => {
    harness = await HttpTestApp.start();
  });

  afterAll(() => harness.stop(), 60_000);

  /** A signed-in person who has not become a coach yet. */
  const newPerson = (overrides: Record<string, unknown> = {}) =>
    harness.signedUpPerson(overrides);

  /** Becomes a coach, and registers the workspace for clean-up. */
  const becomeCoach = async (
    session: Awaited<ReturnType<typeof newPerson>>['session'],
    body: Record<string, unknown> = { brandName: 'Sara Fit' },
  ) => {
    const response = await harness.as(session).post('/workspaces').send(body);
    if (response.status === 201) {
      harness.trackWorkspace(response.body.id);
    }
    return response;
  };

  describe('POST /workspaces: becoming a coach', () => {
    it('creates the workspace and makes the person its owner', async () => {
      const { session } = await newPerson();

      const response = await becomeCoach(session, { brandName: 'Sara Fit' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: expect.any(String),
        slug: expect.stringMatching(/^sara-fit/),
        brandName: 'Sara Fit',
        currency: 'EGP',
      });

      const profile = await harness.me(session.accessToken).expect(200);
      expect(profile.body).toMatchObject({
        workspaces: [
          { workspaceId: response.body.id, role: 'coach', isOwner: true },
        ],
        activeWorkspaceId: response.body.id,
        role: 'coach',
        isOwner: true,
      });
    });

    it('uses the person’s own name when no brand is given', async () => {
      const { session } = await newPerson({ fullName: 'Karim Hassan' });

      const response = await becomeCoach(session, {});

      expect(response.status).toBe(201);
      expect(response.body.brandName).toBe('Karim Hassan');
      expect(response.body.slug).toMatch(/^karim-hassan/);
    });

    it('trims the brand', async () => {
      const { session } = await newPerson();

      const response = await becomeCoach(session, {
        brandName: '   Spaced Out Gym   ',
      });

      expect(response.body.brandName).toBe('Spaced Out Gym');
    });

    it('gives two coaches with the same brand different handles', async () => {
      const first = await becomeCoach((await newPerson()).session, {
        brandName: 'Twin Brand Gym',
      });
      const second = await becomeCoach((await newPerson()).session, {
        brandName: 'Twin Brand Gym',
      });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(second.body.slug).not.toBe(first.body.slug);
    });

    it('refuses a second workspace for someone who already owns one', async () => {
      const { session } = await newPerson();
      await becomeCoach(session, { brandName: 'First Place' });

      const again = await becomeCoach(session, { brandName: 'Second Place' });

      expect(again.status).toBe(409);
      expect(again.body.code).toBe('WORKSPACE_ALREADY_EXISTS');
    });

    it.each([
      ['a blank brand', { brandName: '   ' }],
      ['a brand that is too long', { brandName: 'x'.repeat(81) }],
      ['a brand that is not text', { brandName: 42 }],
      [
        'a field it does not know',
        { brandName: 'Fine', slug: 'my-own-handle' },
      ],
    ])('refuses %s', async (_label, body) => {
      const { session } = await newPerson();

      const response = await becomeCoach(session, body);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_FAILED');
    });

    it('needs a token', async () => {
      const response = await harness
        .server()
        .post('/api/v1/workspaces')
        .send({ brandName: 'No Token' })
        .expect(401);

      expect(response.body.code).toBe('MISSING_TOKEN');
    });

    it('needs the person to exist, not just a login', async () => {
      const token = await harness.supabase.accessTokenFor(
        randomUUID(),
        harness.uniquePhone(),
      );

      const response = await harness
        .server()
        .post('/api/v1/workspaces')
        .set('Authorization', `Bearer ${token}`)
        .send({ brandName: 'No Person' })
        .expect(403);

      expect(response.body.code).toBe('NOT_REGISTERED');
    });
  });

  /** A coach with a workspace, signed in and ready to act in it. */
  const newCoach = async (brandName = 'Settings Gym') => {
    const person = await newPerson();
    const created = await becomeCoach(person.session, { brandName });
    return { session: person.session, workspace: created.body };
  };

  describe('GET /workspaces/current', () => {
    it('shows the workspace with its defaults', async () => {
      const { session, workspace } = await newCoach('Defaults Gym');

      const response = await harness
        .as(session)
        .get('/workspaces/current')
        .expect(200);

      expect(response.body).toEqual({
        id: workspace.id,
        slug: workspace.slug,
        brandName: 'Defaults Gym',
        logoUrl: null,
        currency: 'EGP',
        unitSystem: 'metric',
        expiryAlertDays: 7,
      });
    });

    it('tells a person with no workspace to create one first', async () => {
      const { session } = await newPerson();

      const response = await harness
        .as(session)
        .get('/workspaces/current')
        .expect(403);

      expect(response.body.code).toBe('NO_WORKSPACE');
    });

    it('will not show someone else’s workspace, even when it is named', async () => {
      const mine = await newCoach('Mine Gym');
      const theirs = await newCoach('Theirs Gym');

      const response = await harness
        .as(mine.session, theirs.workspace.id)
        .get('/workspaces/current')
        .expect(403);

      expect(response.body.code).toBe('WORKSPACE_FORBIDDEN');
    });

    it('needs a token', async () => {
      await harness.server().get('/api/v1/workspaces/current').expect(401);
    });
  });

  describe('PATCH /workspaces/current', () => {
    it('changes the settings and returns the workspace as it now is', async () => {
      const { session, workspace } = await newCoach('Before Gym');

      const response = await harness
        .as(session)
        .patch('/workspaces/current')
        .send({
          brandName: '  After Gym  ',
          currency: 'USD',
          unitSystem: 'imperial',
          expiryAlertDays: 14,
        })
        .expect(200);

      expect(response.body).toEqual({
        id: workspace.id,
        slug: workspace.slug,
        brandName: 'After Gym',
        logoUrl: null,
        currency: 'USD',
        unitSystem: 'imperial',
        expiryAlertDays: 14,
      });
      const reread = await harness.as(session).get('/workspaces/current');
      expect(reread.body).toEqual(response.body);
    });

    it('keeps the handle when the brand changes, so links already sent still work', async () => {
      const { session, workspace } = await newCoach('Stable Handle Gym');

      const response = await harness
        .as(session)
        .patch('/workspaces/current')
        .send({ brandName: 'A Completely New Name' })
        .expect(200);

      expect(response.body.slug).toBe(workspace.slug);
    });

    it.each([
      ['the brand', { brandName: 'Only Brand' }, { brandName: 'Only Brand' }],
      ['the currency', { currency: 'SAR' }, { currency: 'SAR' }],
      ['the units', { unitSystem: 'imperial' }, { unitSystem: 'imperial' }],
      ['the alert days', { expiryAlertDays: 3 }, { expiryAlertDays: 3 }],
    ])(
      'changes only %s when only that is sent',
      async (_label, body, changed) => {
        const { session } = await newCoach('Partial Gym');
        const before = (await harness.as(session).get('/workspaces/current'))
          .body;

        const response = await harness
          .as(session)
          .patch('/workspaces/current')
          .send(body)
          .expect(200);

        expect(response.body).toEqual({ ...before, ...changed });
      },
    );

    it('changes nothing when nothing is sent', async () => {
      const { session } = await newCoach('Unchanged Gym');
      const before = (await harness.as(session).get('/workspaces/current'))
        .body;

      const response = await harness
        .as(session)
        .patch('/workspaces/current')
        .send({})
        .expect(200);

      expect(response.body).toEqual(before);
    });

    it('never changes another coach’s workspace', async () => {
      const mine = await newCoach('Mine Settings');
      const theirs = await newCoach('Theirs Settings');
      const theirsBefore = (
        await harness.as(theirs.session).get('/workspaces/current')
      ).body;

      await harness
        .as(mine.session)
        .patch('/workspaces/current')
        .send({ brandName: 'Taken Over' })
        .expect(200);
      const blocked = await harness
        .as(mine.session, theirs.workspace.id)
        .patch('/workspaces/current')
        .send({ brandName: 'Taken Over Too' })
        .expect(403);

      expect(blocked.body.code).toBe('WORKSPACE_FORBIDDEN');
      const theirsAfter = (
        await harness.as(theirs.session).get('/workspaces/current')
      ).body;
      expect(theirsAfter).toEqual(theirsBefore);
    });

    it.each([
      ['a blank brand', { brandName: '   ' }],
      ['a brand that is too long', { brandName: 'x'.repeat(81) }],
      ['a currency in lower case', { currency: 'egp' }],
      ['a currency that is too short', { currency: 'EG' }],
      ['a currency that does not exist', { currency: 'ZZZ' }],
      ['a currency that is not text', { currency: 818 }],
      ['units that are not known', { unitSystem: 'stones' }],
      ['alert days of zero', { expiryAlertDays: 0 }],
      ['negative alert days', { expiryAlertDays: -3 }],
      ['alert days beyond two months', { expiryAlertDays: 61 }],
      ['alert days with a fraction', { expiryAlertDays: 2.5 }],
      ['alert days as text', { expiryAlertDays: '7' }],
      ['a handle', { slug: 'my-own-handle' }],
      ['an id', { id: 'x' }],
      ['a logo address', { logoUrl: 'https://evil.example.com/x.png' }],
    ])('refuses %s', async (_label, body) => {
      const { session } = await newCoach('Refusing Gym');

      const response = await harness
        .as(session)
        .patch('/workspaces/current')
        .send(body)
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_FAILED');
    });

    it('tells a person with no workspace to create one first', async () => {
      const { session } = await newPerson();

      const response = await harness
        .as(session)
        .patch('/workspaces/current')
        .send({ brandName: 'Nowhere' })
        .expect(403);

      expect(response.body.code).toBe('NO_WORKSPACE');
    });
  });

  describe('the logo', () => {
    const picture = (
      width = 200,
      height = 200,
      format: 'png' | 'jpeg' | 'webp' = 'png',
    ) =>
      sharp({ create: { width, height, channels: 3, background: 'teal' } })
        [format]()
        .toBuffer();

    const upload = (
      session: Parameters<typeof harness.as>[0],
      bytes: Buffer,
      options: { filename?: string; contentType?: string; field?: string } = {},
    ) =>
      harness
        .as(session)
        .put('/workspaces/current/logo')
        .attach(options.field ?? 'file', bytes, {
          filename: options.filename ?? 'logo.png',
          contentType: options.contentType ?? 'image/png',
        });

    const logoKeysOf = (workspaceId: string) =>
      harness.storage.keysUnder('gym-public', `workspaces/${workspaceId}/`);

    it('is stored as a fresh WebP in the public bucket, and shown on the workspace', async () => {
      const { session, workspace } = await newCoach('Logo Gym');

      const response = await upload(session, await picture()).expect(200);

      const [key] = logoKeysOf(workspace.id);
      expect(key).toMatch(
        new RegExp(`^workspaces/${workspace.id}/logo-[0-9a-f]{12}\\.webp$`),
      );
      expect(response.body).toEqual({
        logoUrl: expect.stringContaining(
          `/storage/v1/object/public/gym-public/${key}`,
        ),
      });
      const stored = harness.storage.get('gym-public', key)!;
      expect(stored.contentType).toBe('image/webp');
      expect((await sharp(stored.bytes).metadata()).format).toBe('webp');

      const current = await harness.as(session).get('/workspaces/current');
      expect(current.body.logoUrl).toBe(response.body.logoUrl);
    });

    it('is shrunk to fit 512 pixels, never enlarged', async () => {
      const { session, workspace } = await newCoach();
      await upload(session, await picture(3000, 1500)).expect(200);
      const big = harness.storage.get(
        'gym-public',
        logoKeysOf(workspace.id)[0],
      )!;

      await upload(session, await picture(60, 40)).expect(200);
      const small = harness.storage.get(
        'gym-public',
        logoKeysOf(workspace.id)[0],
      )!;

      const bigMeta = await sharp(big.bytes).metadata();
      expect([bigMeta.width, bigMeta.height]).toEqual([512, 256]);
      const smallMeta = await sharp(small.bytes).metadata();
      expect([smallMeta.width, smallMeta.height]).toEqual([60, 40]);
    });

    it('loses the metadata a photo carries, such as where it was taken', async () => {
      const { session, workspace } = await newCoach();
      const withLocation = await sharp({
        create: { width: 100, height: 100, channels: 3, background: 'teal' },
      })
        .jpeg()
        .withExif({ IFD0: { ImageDescription: 'GPS-SECRET-LOCATION' } })
        .toBuffer();
      expect(withLocation.includes('GPS-SECRET-LOCATION')).toBe(true);

      await upload(session, withLocation, {
        filename: 'logo.jpg',
        contentType: 'image/jpeg',
      }).expect(200);

      const stored = harness.storage.get(
        'gym-public',
        logoKeysOf(workspace.id)[0],
      )!;
      expect(stored.bytes.includes('GPS-SECRET-LOCATION')).toBe(false);
    });

    it.each(['png', 'jpeg', 'webp'] as const)(
      'accepts a %s',
      async (format) => {
        const { session } = await newCoach();

        await upload(session, await picture(120, 120, format), {
          filename: `logo.${format}`,
          contentType: `image/${format}`,
        }).expect(200);
      },
    );

    it('replaces the old logo, which is then deleted, and gets an address of its own', async () => {
      const { session, workspace } = await newCoach();
      const first = await upload(session, await picture(100, 100)).expect(200);
      const [firstKey] = logoKeysOf(workspace.id);

      const second = await upload(session, await picture(110, 110)).expect(200);

      expect(second.body.logoUrl).not.toBe(first.body.logoUrl);
      const keys = logoKeysOf(workspace.id);
      expect(keys).toHaveLength(1);
      expect(keys).not.toContain(firstKey);
      expect(second.body.logoUrl).toContain(keys[0]);
    });

    it('keeps each coach’s logo to themselves', async () => {
      const mine = await newCoach();
      const theirs = await newCoach();

      await upload(mine.session, await picture()).expect(200);

      expect(logoKeysOf(theirs.workspace.id)).toEqual([]);
      expect(
        (await harness.as(theirs.session).get('/workspaces/current')).body
          .logoUrl,
      ).toBeNull();
    });

    it.each([
      [
        'a text file called logo.png',
        Buffer.from('just some words'),
        'logo.png',
        'image/png',
      ],
      [
        'an svg, which can carry script',
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        ),
        'logo.svg',
        'image/svg+xml',
      ],
      [
        'a pdf',
        Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n'),
        'logo.pdf',
        'application/pdf',
      ],
    ])(
      'refuses %s, and stores nothing',
      async (_label, bytes, filename, contentType) => {
        const { session, workspace } = await newCoach();

        const response = await upload(session, bytes, {
          filename,
          contentType,
        }).expect(415);

        expect(response.body.code).toBe('UNSUPPORTED_FILE_TYPE');
        expect(logoKeysOf(workspace.id)).toEqual([]);
      },
    );

    it('refuses a gif, which is not an accepted format', async () => {
      const { session } = await newCoach();
      const gif = await sharp({
        create: { width: 20, height: 20, channels: 3, background: 'teal' },
      })
        .gif()
        .toBuffer();

      const response = await upload(session, gif, {
        filename: 'logo.gif',
        contentType: 'image/gif',
      }).expect(415);

      expect(response.body.code).toBe('UNSUPPORTED_FILE_TYPE');
    });

    it('refuses a file that only starts like a png, before it is even decoded', async () => {
      const { session, workspace } = await newCoach();
      const onlyAHeader = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from('nothing an image decoder could use'),
      ]);

      const response = await upload(session, onlyAHeader).expect(415);

      expect(response.body.code).toBe('UNSUPPORTED_FILE_TYPE');
      expect(logoKeysOf(workspace.id)).toEqual([]);
    });

    it('refuses a real png whose picture data is damaged, and keeps the logo it had', async () => {
      const { session, workspace } = await newCoach();
      const kept = await upload(session, await picture()).expect(200);
      const noisy = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: 'teal',
          noise: { type: 'gaussian', mean: 128, sigma: 60 },
        },
      })
        .png()
        .toBuffer();
      // the header is intact, so it passes for a png; the compressed picture inside is not
      const damaged = Buffer.from(noisy);
      damaged.fill(0xff, 100, 160);

      const response = await upload(session, damaged).expect(422);

      expect(response.body.code).toBe('INVALID_IMAGE');
      expect(logoKeysOf(workspace.id)).toHaveLength(1);
      expect(
        (await harness.as(session).get('/workspaces/current')).body.logoUrl,
      ).toBe(kept.body.logoUrl);
    });

    it('refuses a file over 2 MB without storing it', async () => {
      const { session, workspace } = await newCoach();

      const response = await upload(
        session,
        Buffer.alloc(2.5 * 1024 * 1024),
      ).expect(413);

      expect(response.body.code).toBe('PAYLOAD_TOO_LARGE');
      expect(logoKeysOf(workspace.id)).toEqual([]);
    });

    it('needs a file', async () => {
      const { session } = await newCoach();

      const response = await harness
        .as(session)
        .put('/workspaces/current/logo')
        .expect(400);

      expect(response.body.code).toBe('FILE_REQUIRED');
    });

    it('needs the file in the field called file', async () => {
      const { session } = await newCoach();

      await upload(session, await picture(), { field: 'photo' }).expect(400);
    });

    it('says storage is unavailable, and changes nothing, when storage is down', async () => {
      const { session, workspace } = await newCoach();
      const kept = await upload(session, await picture()).expect(200);

      harness.storage.down = true;
      try {
        const response = await upload(session, await picture(90, 90)).expect(
          503,
        );
        expect(response.body.code).toBe('FILE_STORAGE_UNAVAILABLE');
      } finally {
        harness.storage.down = false;
      }

      expect(logoKeysOf(workspace.id)).toHaveLength(1);
      expect(
        (await harness.as(session).get('/workspaces/current')).body.logoUrl,
      ).toBe(kept.body.logoUrl);
    });

    it('needs a token', async () => {
      await harness
        .server()
        .put('/api/v1/workspaces/current/logo')
        .attach('file', await picture(), 'logo.png')
        .expect(401);
    });

    it('tells a person with no workspace to create one first', async () => {
      const { session } = await newPerson();

      const response = await upload(session, await picture()).expect(403);

      expect(response.body.code).toBe('NO_WORKSPACE');
    });
  });

  describe('DELETE /workspaces/current/logo', () => {
    const picture = () =>
      sharp({
        create: { width: 80, height: 80, channels: 3, background: 'teal' },
      })
        .png()
        .toBuffer();

    it('removes the logo from the workspace and from storage', async () => {
      const { session, workspace } = await newCoach();
      await harness
        .as(session)
        .put('/workspaces/current/logo')
        .attach('file', await picture(), {
          filename: 'logo.png',
          contentType: 'image/png',
        })
        .expect(200);

      await harness.as(session).delete('/workspaces/current/logo').expect(204);

      expect(
        (await harness.as(session).get('/workspaces/current')).body.logoUrl,
      ).toBeNull();
      expect(
        harness.storage.keysUnder('gym-public', `workspaces/${workspace.id}/`),
      ).toEqual([]);
    });

    it('is fine when there is no logo', async () => {
      const { session } = await newCoach();

      await harness.as(session).delete('/workspaces/current/logo').expect(204);
    });

    it('needs a token', async () => {
      await harness
        .server()
        .delete('/api/v1/workspaces/current/logo')
        .expect(401);
    });

    it('tells a person with no workspace to create one first', async () => {
      const { session } = await newPerson();

      const response = await harness
        .as(session)
        .delete('/workspaces/current/logo')
        .expect(403);

      expect(response.body.code).toBe('NO_WORKSPACE');
    });
  });
});
