/**
 * Answers the Supabase Storage calls the way Supabase does, keeping what is uploaded in
 * memory so a test can see exactly what was stored and deleted. Like the real buckets it
 * only accepts WebP, and it can be told to fail.
 */
export class FakeSupabaseStorage {
  readonly objects = new Map<string, { bytes: Buffer; contentType: string }>();
  /** Answers every call with a server error. */
  down = false;

  constructor(private readonly secretKey: string) {}

  readonly fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : input);
    const headers = new Headers(init?.headers);
    if (
      headers.get('apikey') !== this.secretKey ||
      headers.get('authorization') !== `Bearer ${this.secretKey}`
    ) {
      return this.reply(401, { message: 'invalid key' });
    }
    if (this.down) {
      return this.reply(500, { message: 'storage is down' });
    }

    const path = url.pathname.replace('/storage/v1', '');
    const method = init?.method ?? 'GET';

    if (method === 'POST' && path.startsWith('/object/')) {
      return this.upload(path, headers, init?.body as Uint8Array);
    }
    if (method === 'DELETE' && path.startsWith('/object/')) {
      return this.remove(path.slice('/object/'.length), init?.body as string);
    }
    return this.reply(404, { message: 'not found' });
  };

  has(bucket: string, key: string): boolean {
    return this.objects.has(`${bucket}/${key}`);
  }

  get(bucket: string, key: string) {
    return this.objects.get(`${bucket}/${key}`);
  }

  /** Every key in a bucket that starts with the prefix. */
  keysUnder(bucket: string, prefix: string): string[] {
    return [...this.objects.keys()]
      .filter((id) => id.startsWith(`${bucket}/${prefix}`))
      .map((id) => id.slice(bucket.length + 1));
  }

  private upload(path: string, headers: Headers, body: Uint8Array) {
    const [bucket, ...rest] = path.slice('/object/'.length).split('/');
    const key = rest.map(decodeURIComponent).join('/');
    const contentType = headers.get('content-type') ?? '';
    if (contentType !== 'image/webp') {
      // the buckets accept WebP only
      return this.reply(400, { statusCode: '415', error: 'invalid_mime_type' });
    }
    this.objects.set(`${bucket}/${key}`, {
      bytes: Buffer.from(body),
      contentType,
    });
    return this.reply(200, { Key: `${bucket}/${key}` });
  }

  private remove(bucket: string, body: string) {
    const { prefixes } = JSON.parse(body) as { prefixes: string[] };
    for (const prefix of prefixes) {
      this.objects.delete(`${bucket}/${prefix}`);
    }
    return this.reply(200, []);
  }

  private reply(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }
}
