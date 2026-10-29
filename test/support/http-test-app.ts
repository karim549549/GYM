import { HOOK_SECRET_BASE64, SECRET_KEY } from './test-env';
import { randomInt, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { eq, inArray } from 'drizzle-orm';
import { exportJWK, generateKeyPair } from 'jose';
import { Webhook } from 'standardwebhooks';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import type { Env } from '../../src/config/env.schema';
import { ClientConsentType } from '../../src/consents/enums/client-consent-type.enum';
import { ConsentSource } from '../../src/consents/enums/consent-source.enum';
import { clientConsents, people, workspaces } from '../../src/database/schema';
import { TransactionManager } from '../../src/database/transaction.manager';
import { MockWhatsAppClient } from '../../src/whatsapp/integrations/mock-whatsapp.client';
import { WhatsAppClient } from '../../src/whatsapp/whatsapp.client';
import { FakeSupabaseAuth } from './fake-supabase-auth';
import { FakeSupabaseStorage } from './fake-supabase-storage';

export interface TestSession {
  accessToken: string;
  refreshToken: string;
}

/**
 * The whole app over HTTP with the outside world replaced: Supabase Auth is a stateful
 * fake that really calls our signed hook, and WhatsApp is the mock. Everything else is the
 * real thing, including the database. It cleans up what a test made, through
 * `trackPhone` and `trackWorkspace`.
 */
export class HttpTestApp {
  static readonly PASSWORD = 'correct-horse-battery';

  private readonly phones: string[] = [];
  private readonly workspaceIds: string[] = [];

  private constructor(
    readonly app: INestApplication,
    readonly supabase: FakeSupabaseAuth,
    readonly storage: FakeSupabaseStorage,
    readonly whatsapp: MockWhatsAppClient,
    readonly tx: TransactionManager,
  ) {}

  static async start(): Promise<HttpTestApp> {
    const pair = await generateKeyPair('ES256');
    const jwk = {
      ...(await exportJWK(pair.publicKey)),
      kid: 'test-key',
      alg: 'ES256',
      use: 'sig',
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // the app builds its own Supabase client from the configuration; only the network is faked
    const config = moduleRef.get<ConfigService<Env, true>>(ConfigService);
    const supabase = new FakeSupabaseAuth(
      pair.privateKey,
      `${config.get('SUPABASE_URL', { infer: true })}/auth/v1`,
      config.get('SUPABASE_PUBLISHABLE_KEY', { infer: true }),
    );
    const storage = new FakeSupabaseStorage(SECRET_KEY);
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const { pathname } = new URL(
        input instanceof Request ? input.url : input,
      );
      if (pathname.endsWith('/.well-known/jwks.json')) {
        return Response.json({ keys: [jwk] });
      }
      return pathname.startsWith('/storage/v1/')
        ? storage.fetch(input, init)
        : supabase.fetch(input, init);
    });

    const app = moduleRef.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();

    const harness = new HttpTestApp(
      app,
      supabase,
      storage,
      moduleRef.get(WhatsAppClient) as MockWhatsAppClient,
      moduleRef.get(TransactionManager),
    );
    // Supabase hands each code to the hook, as it does in production
    supabase.deliver = async (phone, otp, userId) => {
      await harness
        .signedHookCall({
          user: { id: userId, phone, email: '' },
          sms: { otp },
        })
        .expect(200);
    };
    return harness;
  }

  async stop(): Promise<void> {
    jest.restoreAllMocks();
    // row level security needs one transaction per workspace, so they go in parallel
    await Promise.all(
      this.workspaceIds.map((workspaceId) =>
        this.tx.run(
          () =>
            this.tx.db.delete(workspaces).where(eq(workspaces.id, workspaceId)),
          { workspaceId },
        ),
      ),
    );
    if (this.phones.length > 0) {
      await this.tx.db.delete(people).where(inArray(people.phone, this.phones));
    }
    await this.app.close();
  }

  server() {
    return request(this.app.getHttpServer());
  }

  trackPhone(phone: string): string {
    this.phones.push(phone);
    return phone;
  }

  trackWorkspace(workspaceId: string): string {
    this.workspaceIds.push(workspaceId);
    return workspaceId;
  }

  /** An Egyptian mobile number no other test uses, removed with its person afterwards. */
  uniquePhone(): string {
    return this.trackPhone(`+2010${randomInt(10_000_000, 99_999_999)}`);
  }

  /** What a client ticks on the intake form when they agree to everything. */
  static readonly ALL_CLIENT_CONSENTS = {
    dataProcessing: true,
    healthData: true,
    whatsappNotifications: true,
  };

  /** Records that a client agreed, as the intake form would have, for a test about something else. */
  async grantClientConsents(
    workspaceId: string,
    clientId: string,
    types: ClientConsentType[] = Object.values(ClientConsentType),
  ): Promise<void> {
    await this.tx.run(
      () =>
        this.tx.db.insert(clientConsents).values(
          types.map((type) => ({
            workspaceId,
            clientId,
            type,
            granted: true,
            textVersion: 'test',
            source: ConsentSource.INTAKE_LINK,
          })),
        ),
      { workspaceId },
    );
  }

  registration(overrides: Record<string, unknown> = {}) {
    return {
      phone: this.uniquePhone(),
      password: HttpTestApp.PASSWORD,
      fullName: 'Sara Ali',
      acceptTerms: true,
      ...overrides,
    };
  }

  codeSentTo(phone: string): string | undefined {
    return this.whatsapp.lastTo(phone)?.params[0];
  }

  /** Registers and confirms a phone, leaving a person who is signed in. */
  async signedUpPerson(overrides: Record<string, unknown> = {}) {
    const body = this.registration(overrides);
    await this.server().post('/api/v1/auth/register').send(body).expect(202);
    const verified = await this.server()
      .post('/api/v1/auth/verify')
      .send({ phone: body.phone, code: this.codeSentTo(body.phone as string) })
      .expect(200);
    return { body, session: verified.body.session as TestSession };
  }

  async personRow(phone: string) {
    const [row] = await this.tx.db
      .select()
      .from(people)
      .where(eq(people.phone, phone));
    return row;
  }

  /** A request made as the person the session belongs to, acting in a workspace when one is named. */
  as(session: TestSession, workspaceId?: string) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.accessToken}`,
      ...(workspaceId && { 'x-workspace-id': workspaceId }),
    };
    const server = this.server();
    const withHeaders = <T extends request.Test>(call: T): T => {
      for (const [name, value] of Object.entries(headers)) {
        call.set(name, value);
      }
      return call;
    };
    return {
      get: (path: string) => withHeaders(server.get(`/api/v1${path}`)),
      post: (path: string) => withHeaders(server.post(`/api/v1${path}`)),
      put: (path: string) => withHeaders(server.put(`/api/v1${path}`)),
      patch: (path: string) => withHeaders(server.patch(`/api/v1${path}`)),
      delete: (path: string) => withHeaders(server.delete(`/api/v1${path}`)),
    };
  }

  me(accessToken: string) {
    return this.server()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
  }

  /** A call as Supabase makes it to our hook: signed over the exact body. */
  signedHookCall(
    payload: unknown,
    options: { secret?: string; at?: Date } = {},
  ) {
    const body = JSON.stringify(payload);
    const id = `msg_${randomUUID()}`;
    const at = options.at ?? new Date();
    return this.server()
      .post('/api/v1/auth/hooks/send-sms')
      .set('content-type', 'application/json')
      .set('webhook-id', id)
      .set('webhook-timestamp', String(Math.floor(at.getTime() / 1000)))
      .set(
        'webhook-signature',
        new Webhook(options.secret ?? HOOK_SECRET_BASE64).sign(id, at, body),
      )
      .send(body);
  }
}
