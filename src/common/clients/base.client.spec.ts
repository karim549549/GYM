import { Logger } from '@nestjs/common';
import { BaseClient, type ClientOptions } from './base.client';

class DownstreamUnavailable extends Error {}

class TestClient extends BaseClient {
  constructor(options: Partial<ClientOptions> = {}) {
    super({
      baseUrl: 'https://api.example.com/v1',
      timeoutMs: 1_000,
      retry: { attempts: 3, baseDelayMs: 0 },
      ...options,
    });
  }

  call(...args: Parameters<BaseClient['send']>) {
    return this.send(...args);
  }

  protected unavailable(): Error {
    return new DownstreamUnavailable();
  }
}

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

function clientAnswering(
  ...answers: Array<
    Response | Error | ((init: RequestInit) => Promise<Response>)
  >
) {
  const calls: Array<{ url: URL; init: RequestInit }> = [];
  const fetchFake = jest.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({
        url: new URL(input instanceof Request ? input.url : input),
        init: init ?? {},
      });
      const answer = answers[Math.min(calls.length, answers.length) - 1];
      if (answer instanceof Error) {
        throw answer;
      }
      return typeof answer === 'function' ? answer(init ?? {}) : answer.clone();
    },
  );
  return { calls, fetchFake };
}

describe('BaseClient', () => {
  beforeAll(() => Logger.overrideLogger(false));

  describe('building the request', () => {
    it('joins the base url, path and query and sends the method', async () => {
      const { calls, fetchFake } = clientAnswering(json(200, {}));
      const client = new TestClient({ fetch: fetchFake });

      await client.call({
        method: 'POST',
        path: '/token',
        query: { grant_type: 'password' },
      });

      expect(calls[0].url.href).toBe(
        'https://api.example.com/v1/token?grant_type=password',
      );
      expect(calls[0].init.method).toBe('POST');
    });

    it('merges the default headers with the request headers, the request winning', async () => {
      const { calls, fetchFake } = clientAnswering(json(200, {}));
      const client = new TestClient({
        fetch: fetchFake,
        headers: { apikey: 'key', 'x-shared': 'default' },
      });

      await client.call({
        method: 'GET',
        path: '/a',
        headers: { 'x-shared': 'request', authorization: 'Bearer t' },
      });

      const headers = new Headers(calls[0].init.headers);
      expect(headers.get('apikey')).toBe('key');
      expect(headers.get('x-shared')).toBe('request');
      expect(headers.get('authorization')).toBe('Bearer t');
    });

    it('sends a body as JSON and none when there is none', async () => {
      const { calls, fetchFake } = clientAnswering(
        json(200, {}),
        json(200, {}),
      );
      const client = new TestClient({ fetch: fetchFake });

      await client.call({ method: 'POST', path: '/a', body: { x: 1 } });
      await client.call({ method: 'POST', path: '/b' });

      expect(calls[0].init.body).toBe('{"x":1}');
      expect(new Headers(calls[0].init.headers).get('content-type')).toBe(
        'application/json',
      );
      expect(calls[1].init.body).toBeUndefined();
    });
  });

  describe('sending bytes', () => {
    it('sends raw bytes untouched, with the content type the caller names', async () => {
      const { calls, fetchFake } = clientAnswering(json(200, {}));
      const client = new TestClient({ fetch: fetchFake });
      const bytes = Buffer.from([1, 2, 3, 255]);

      await client.call({
        method: 'POST',
        path: '/upload',
        body: bytes,
        headers: { 'content-type': 'image/png' },
      });

      expect(calls[0].init.body).toBe(bytes);
      expect(new Headers(calls[0].init.headers).get('content-type')).toBe(
        'image/png',
      );
    });

    it('does not label bytes as JSON when the caller names no type', async () => {
      const { calls, fetchFake } = clientAnswering(json(200, {}));
      const client = new TestClient({ fetch: fetchFake });

      await client.call({ method: 'POST', path: '/u', body: Buffer.from('x') });

      expect(new Headers(calls[0].init.headers).get('content-type')).not.toBe(
        'application/json',
      );
    });
  });

  describe('reading the reply', () => {
    it('returns the status and the parsed body', async () => {
      const { fetchFake } = clientAnswering(json(201, { id: 'x' }));

      await expect(
        new TestClient({ fetch: fetchFake }).call({
          method: 'POST',
          path: '/a',
        }),
      ).resolves.toEqual({ status: 201, body: { id: 'x' } });
    });

    it.each([400, 401, 404, 422, 429, 500])(
      'hands back a %i reply instead of throwing and does not retry it',
      async (status) => {
        const { calls, fetchFake } = clientAnswering(json(status, { e: 1 }));
        const client = new TestClient({ fetch: fetchFake });

        await expect(
          client.call({ method: 'GET', path: '/a' }),
        ).resolves.toEqual({ status, body: { e: 1 } });
        expect(calls).toHaveLength(1);
      },
    );

    it('reads an empty or non-JSON body as undefined', async () => {
      const { fetchFake } = clientAnswering(
        json(204),
        new Response('<html>', { status: 200 }),
      );
      const client = new TestClient({ fetch: fetchFake });

      expect(await client.call({ method: 'GET', path: '/a' })).toEqual({
        status: 204,
        body: undefined,
      });
      expect(await client.call({ method: 'GET', path: '/a' })).toEqual({
        status: 200,
        body: undefined,
      });
    });
  });

  describe('when the other system cannot be reached', () => {
    it('throws what the subclass says unavailable means, with no trace of the cause', async () => {
      const { fetchFake } = clientAnswering(
        new Error('connect ECONNREFUSED secret-host:5432'),
      );
      const client = new TestClient({ fetch: fetchFake });

      const failure = await client
        .call({ method: 'POST', path: '/a' })
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(DownstreamUnavailable);
      expect(JSON.stringify(failure)).not.toContain('secret-host');
      expect((failure as Error).message).not.toContain('secret-host');
    });

    it('treats a call that takes longer than the timeout as unreachable', async () => {
      const { calls, fetchFake } = clientAnswering(
        (init) =>
          new Promise((_resolve, reject) => {
            init.signal!.addEventListener('abort', () =>
              reject(init.signal!.reason),
            );
          }),
      );
      const client = new TestClient({ fetch: fetchFake, timeoutMs: 20 });

      await expect(
        client.call({ method: 'POST', path: '/a' }),
      ).rejects.toBeInstanceOf(DownstreamUnavailable);
      expect(calls).toHaveLength(1);
    });
  });

  describe('retrying', () => {
    it('retries a read after a network failure and returns the later success', async () => {
      const { calls, fetchFake } = clientAnswering(
        new Error('reset'),
        json(200, { ok: true }),
      );
      const client = new TestClient({ fetch: fetchFake });

      await expect(client.call({ method: 'GET', path: '/a' })).resolves.toEqual(
        { status: 200, body: { ok: true } },
      );
      expect(calls).toHaveLength(2);
    });

    it.each([502, 503, 504])('retries a read that got a %i', async (status) => {
      const { calls, fetchFake } = clientAnswering(
        json(status),
        json(200, { ok: true }),
      );
      const client = new TestClient({ fetch: fetchFake });

      await expect(
        client.call({ method: 'GET', path: '/a' }),
      ).resolves.toMatchObject({ status: 200 });
      expect(calls).toHaveLength(2);
    });

    it('gives up after the configured attempts and throws for a network failure', async () => {
      const { calls, fetchFake } = clientAnswering(new Error('reset'));
      const client = new TestClient({ fetch: fetchFake });

      await expect(
        client.call({ method: 'GET', path: '/a' }),
      ).rejects.toBeInstanceOf(DownstreamUnavailable);
      expect(calls).toHaveLength(3);
    });

    it('gives up after the configured attempts and returns the last retriable reply', async () => {
      const { calls, fetchFake } = clientAnswering(json(503, { n: 1 }));
      const client = new TestClient({ fetch: fetchFake });

      await expect(client.call({ method: 'GET', path: '/a' })).resolves.toEqual(
        { status: 503, body: { n: 1 } },
      );
      expect(calls).toHaveLength(3);
    });

    it.each(['POST', 'PATCH'] as const)(
      'does not retry a %s unless the caller says it is safe to repeat',
      async (method) => {
        const { calls, fetchFake } = clientAnswering(new Error('reset'));
        const client = new TestClient({ fetch: fetchFake });

        await expect(
          client.call({ method, path: '/a' }),
        ).rejects.toBeInstanceOf(DownstreamUnavailable);
        expect(calls).toHaveLength(1);
      },
    );

    it('retries a POST the caller marked as safe to repeat', async () => {
      const { calls, fetchFake } = clientAnswering(
        json(503),
        json(200, { ok: true }),
      );
      const client = new TestClient({ fetch: fetchFake });

      await client.call({ method: 'POST', path: '/a', retry: true });

      expect(calls).toHaveLength(2);
    });

    it('does not retry a read the caller marked as not to repeat', async () => {
      const { calls, fetchFake } = clientAnswering(json(503));
      const client = new TestClient({ fetch: fetchFake });

      await client.call({ method: 'GET', path: '/a', retry: false });

      expect(calls).toHaveLength(1);
    });

    it('does not retry at all when configured for a single attempt', async () => {
      const { calls, fetchFake } = clientAnswering(json(503));
      const client = new TestClient({
        fetch: fetchFake,
        retry: { attempts: 1, baseDelayMs: 0 },
      });

      await client.call({ method: 'GET', path: '/a' });

      expect(calls).toHaveLength(1);
    });

    it('waits longer before each further attempt', async () => {
      const { fetchFake } = clientAnswering(json(503));
      const client = new TestClient({
        fetch: fetchFake,
        retry: { attempts: 3, baseDelayMs: 40, maxDelayMs: 1_000 },
      });

      const startedAt = Date.now();
      await client.call({ method: 'GET', path: '/a' });

      // delays are jittered between half and all of 40ms then 80ms
      expect(Date.now() - startedAt).toBeGreaterThanOrEqual(55);
    });
  });

  describe('staying bounded', () => {
    it.each([0, -1, 1.5, 6, 100])(
      'refuses to be configured with %p attempts',
      (attempts) => {
        expect(
          () => new TestClient({ retry: { attempts, baseDelayMs: 0 } }),
        ).toThrow(/attempts/);
      },
    );

    it('accepts one to five attempts', () => {
      for (const attempts of [1, 5]) {
        expect(
          () => new TestClient({ retry: { attempts, baseDelayMs: 0 } }),
        ).not.toThrow();
      }
    });

    it('stops trying once the total time is used up, however many attempts remain', async () => {
      const { calls, fetchFake } = clientAnswering(
        (init) =>
          new Promise((_resolve, reject) => {
            init.signal!.addEventListener('abort', () =>
              reject(init.signal!.reason),
            );
          }),
      );
      const client = new TestClient({
        fetch: fetchFake,
        timeoutMs: 50,
        totalTimeoutMs: 120,
        retry: { attempts: 5, baseDelayMs: 0 },
      });

      const startedAt = Date.now();
      await expect(
        client.call({ method: 'GET', path: '/a' }),
      ).rejects.toBeInstanceOf(DownstreamUnavailable);

      expect(Date.now() - startedAt).toBeLessThan(250);
      expect(calls.length).toBeLessThan(5);
    });

    it('cuts an attempt short when the total time is nearly gone', async () => {
      const { fetchFake } = clientAnswering(
        (init) =>
          new Promise((_resolve, reject) => {
            init.signal!.addEventListener('abort', () =>
              reject(init.signal!.reason),
            );
          }),
      );
      const client = new TestClient({
        fetch: fetchFake,
        timeoutMs: 2_000,
        totalTimeoutMs: 100,
        retry: { attempts: 1, baseDelayMs: 0 },
      });

      const startedAt = Date.now();
      await expect(
        client.call({ method: 'GET', path: '/a' }),
      ).rejects.toBeInstanceOf(DownstreamUnavailable);

      expect(Date.now() - startedAt).toBeLessThan(500);
    });

    it('does not start a retry whose wait would run past the total time', async () => {
      const { calls, fetchFake } = clientAnswering(json(503, { n: 1 }));
      const client = new TestClient({
        fetch: fetchFake,
        totalTimeoutMs: 200,
        retry: { attempts: 3, baseDelayMs: 5_000 },
      });

      const startedAt = Date.now();
      await expect(client.call({ method: 'GET', path: '/a' })).resolves.toEqual(
        { status: 503, body: { n: 1 } },
      );

      expect(calls).toHaveLength(1);
      expect(Date.now() - startedAt).toBeLessThan(150);
    });
  });
});
