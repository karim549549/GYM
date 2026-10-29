import type { ConfigService } from '@nestjs/config';
import { StorageBucket } from '../enums/storage-bucket.enum';
import {
  FileNotFoundException,
  FileStorageUnavailableException,
  FileTooLargeException,
} from '../exceptions/storage-exceptions';
import { SupabaseStorageClient } from './supabase-storage.client';

const STORAGE_URL = 'https://project.supabase.co/storage/v1';
const config = {
  get: (name: string) =>
    ({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_test',
    })[name],
} as unknown as ConfigService<never, true>;

type Call = { url: URL; init: RequestInit };

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

function clientAnswering(answer: (call: Call) => Response) {
  const calls: Call[] = [];
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const call = {
      url: new URL(input instanceof Request ? input.url : input),
      init: init ?? {},
    };
    calls.push(call);
    return answer(call);
  });
  return { client: new SupabaseStorageClient(config), calls };
}

const header = (call: Call, name: string) =>
  new Headers(call.init.headers).get(name);

describe('SupabaseStorageClient', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('every call', () => {
    it('presents the secret key to Supabase', async () => {
      const { client, calls } = clientAnswering(() => json(200, {}));

      await client.remove(StorageBucket.FILES, 'k');

      expect(header(calls[0], 'apikey')).toBe('sb_secret_test');
      expect(header(calls[0], 'authorization')).toBe('Bearer sb_secret_test');
    });

    it('never puts the reply from Supabase into the error it throws', async () => {
      const { client } = clientAnswering(() =>
        json(400, {
          message: 'secret-internal-detail',
          key: 'sb_secret_test',
        }),
      );

      const failure = await client
        .remove(StorageBucket.FILES, 'k')
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(FileStorageUnavailableException);
      expect(JSON.stringify(failure)).not.toContain('secret-internal-detail');
      expect(JSON.stringify(failure)).not.toContain('sb_secret_test');
    });
  });

  describe('upload', () => {
    it('posts the bytes to the bucket under the key, replacing what is there', async () => {
      const { client, calls } = clientAnswering(() =>
        json(200, { Key: 'gym-files/workspaces/w1/logo' }),
      );
      const bytes = Buffer.from('logo-bytes');

      await client.upload(
        StorageBucket.FILES,
        'workspaces/w1/logo',
        bytes,
        'image/png',
      );

      expect(calls).toHaveLength(1);
      expect(calls[0].url.href).toBe(
        `${STORAGE_URL}/object/gym-files/workspaces/w1/logo`,
      );
      expect(calls[0].init.method).toBe('POST');
      expect(calls[0].init.body).toBe(bytes);
      expect(header(calls[0], 'content-type')).toBe('image/png');
      expect(header(calls[0], 'x-upsert')).toBe('true');
    });

    it('encodes each part of the key', async () => {
      const { client, calls } = clientAnswering(() => json(200, {}));

      await client.upload(
        StorageBucket.FILES,
        'workspaces/w 1/a#b?.png',
        Buffer.from('x'),
        'image/png',
      );

      expect(calls[0].url.pathname).toBe(
        '/storage/v1/object/gym-files/workspaces/w%201/a%23b%3F.png',
      );
    });

    it('says so when the file is over the bucket limit', async () => {
      const { client } = clientAnswering(() =>
        json(413, { statusCode: '413', error: 'Payload too large' }),
      );

      await expect(
        client.upload(StorageBucket.FILES, 'k', Buffer.from('x'), 'image/png'),
      ).rejects.toBeInstanceOf(FileTooLargeException);
    });

    it('is repeated when it fails in transit, since it writes the same bytes to the same key', async () => {
      let answered = 0;
      const { client, calls } = clientAnswering(() =>
        ++answered < 2 ? json(503) : json(200, {}),
      );

      await client.upload(
        StorageBucket.FILES,
        'k',
        Buffer.from('x'),
        'image/png',
      );

      expect(calls).toHaveLength(2);
    });

    it.each([400, 401, 403, 404])(
      'reports a %i from Supabase as storage being unavailable',
      async (status) => {
        const { client } = clientAnswering(() => json(status, {}));

        await expect(
          client.upload(
            StorageBucket.FILES,
            'k',
            Buffer.from('x'),
            'image/png',
          ),
        ).rejects.toBeInstanceOf(FileStorageUnavailableException);
      },
    );
  });

  describe('remove', () => {
    it('asks Supabase to delete the key', async () => {
      const { client, calls } = clientAnswering(() => json(200, []));

      await client.remove(StorageBucket.FILES, 'workspaces/w1/logo');

      expect(calls[0].url.href).toBe(`${STORAGE_URL}/object/gym-files`);
      expect(calls[0].init.method).toBe('DELETE');
      expect(JSON.parse(calls[0].init.body as string)).toEqual({
        prefixes: ['workspaces/w1/logo'],
      });
    });

    it('treats a key that is already gone as removed', async () => {
      const { client } = clientAnswering(() => json(200, []));

      await expect(
        client.remove(StorageBucket.FILES, 'missing'),
      ).resolves.toBeUndefined();
    });

    it('reports a failure as storage being unavailable', async () => {
      const { client } = clientAnswering(() => json(400, {}));

      await expect(
        client.remove(StorageBucket.FILES, 'k'),
      ).rejects.toBeInstanceOf(FileStorageUnavailableException);
    });
  });

  describe('signedUrl', () => {
    it('returns the full link Supabase signed, for the lifetime asked', async () => {
      const { client, calls } = clientAnswering(() =>
        json(200, {
          signedURL: '/object/sign/gym-files/workspaces/w1/logo?token=abc.def',
        }),
      );

      await expect(
        client.signedUrl(StorageBucket.FILES, 'workspaces/w1/logo', 300),
      ).resolves.toBe(
        `${STORAGE_URL}/object/sign/gym-files/workspaces/w1/logo?token=abc.def`,
      );
      expect(calls[0].url.href).toBe(
        `${STORAGE_URL}/object/sign/gym-files/workspaces/w1/logo`,
      );
      expect(calls[0].init.method).toBe('POST');
      expect(JSON.parse(calls[0].init.body as string)).toEqual({
        expiresIn: 300,
      });
    });

    it.each([
      ['a 404', () => json(404, { error: 'not_found' })],
      [
        'a 400 that says 404',
        () => json(400, { statusCode: '404', error: 'not_found' }),
      ],
    ])('says so when the file does not exist, on %s', async (_label, reply) => {
      const { client } = clientAnswering(reply);

      await expect(
        client.signedUrl(StorageBucket.FILES, 'missing', 60),
      ).rejects.toBeInstanceOf(FileNotFoundException);
    });

    it('reports a reply without a link as storage being unavailable', async () => {
      const { client } = clientAnswering(() => json(200, {}));

      await expect(
        client.signedUrl(StorageBucket.FILES, 'k', 60),
      ).rejects.toBeInstanceOf(FileStorageUnavailableException);
    });

    it('reports a link that does not point into Supabase Storage as unavailable', async () => {
      const { client } = clientAnswering(() =>
        json(200, { signedURL: 'https://evil.example.com/steal?token=x' }),
      );

      await expect(
        client.signedUrl(StorageBucket.FILES, 'k', 60),
      ).rejects.toBeInstanceOf(FileStorageUnavailableException);
    });
  });

  describe('publicUrl', () => {
    it('is the address anyone can open a file of a public bucket at', () => {
      const { client } = clientAnswering(() => json(200, {}));

      expect(
        client.publicUrl(StorageBucket.PUBLIC, 'workspaces/w1/logo-ab12.webp'),
      ).toBe(
        `${STORAGE_URL}/object/public/gym-public/workspaces/w1/logo-ab12.webp`,
      );
    });

    it('encodes each part of the key', () => {
      const { client } = clientAnswering(() => json(200, {}));

      expect(
        client.publicUrl(StorageBucket.PUBLIC, 'workspaces/w 1/a#b?.webp'),
      ).toBe(
        `${STORAGE_URL}/object/public/gym-public/workspaces/w%201/a%23b%3F.webp`,
      );
    });

    it('makes no call: it only builds the address', () => {
      const { client, calls } = clientAnswering(() => json(200, {}));

      client.publicUrl(StorageBucket.PUBLIC, 'k');

      expect(calls).toHaveLength(0);
    });
  });

  describe('which bucket', () => {
    it.each(Object.values(StorageBucket))(
      'works in %s only, for upload, remove and signing',
      async (bucket) => {
        const { client, calls } = clientAnswering((call) =>
          call.url.pathname.includes('/sign/')
            ? json(200, { signedURL: `/object/sign/${bucket}/k?token=t` })
            : json(200, {}),
        );

        await client.upload(bucket, 'k', Buffer.from('x'), 'image/webp');
        await client.remove(bucket, 'k');
        await client.signedUrl(bucket, 'k', 60);

        expect(calls[0].url.pathname).toBe(`/storage/v1/object/${bucket}/k`);
        expect(calls[1].url.pathname).toBe('/storage/v1/object/' + bucket);
        expect(calls[2].url.pathname).toBe(
          `/storage/v1/object/sign/${bucket}/k`,
        );
      },
    );
  });
});
