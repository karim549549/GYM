import {
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { ConfigService } from '@nestjs/config';
import type { ClientRecord } from '../../clients/interfaces/client.interface';
import { ClientNotFoundException } from '../../clients/exceptions/client-exceptions';
import { ClientsService } from '../../clients/clients.service';
import type { Env } from '../../config/env.schema';
import { TransactionManager } from '../../database/transaction.manager';
import {
  ProgramLinkNotFoundException,
  ProgramLockedException,
  ProgramSessionRequiredException,
} from '../exceptions/program-link-exceptions';
import { ProgramLinksQueryHandler } from '../handlers/program-links-query.handler';
import type {
  ProgramLinkTarget,
  ProgramSessionResult,
} from '../interfaces/program-link.interface';
import { ProgramLockPolicy } from '../policies/program-lock.policy';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keyLength: number,
) => Promise<Buffer>;

interface SessionPayload {
  /** The link, its workspace and the access version it was signed for. */
  l: string;
  w: string;
  v: number;
  /** Expiry, in seconds since 1970. */
  e: number;
}

/**
 * What the public program flows share: finding the link by the secret in its address, checking a
 * password, and the session that keeps a device signed in. Nobody is signed in to start with, so the
 * token is only what finds the link; the mobile number and the password are what prove who is asking.
 *
 * A session is `v1.<payload>.<signature>`: the payload names the link and the access version, and is
 * signed with PROGRAM_SESSION_SECRET. Nothing is stored for it; the coach resetting access raises the
 * version on the link, and every older session stops matching.
 */
export abstract class BaseProgramAccessOrchestrator {
  static readonly SESSION_DAYS = 30;
  private static readonly KEY_LENGTH = 64;

  constructor(
    protected readonly programLinks: ProgramLinksQueryHandler,
    protected readonly lockPolicy: ProgramLockPolicy,
    protected readonly clients: ClientsService,
    protected readonly config: ConfigService<Env, true>,
    protected readonly transactions: TransactionManager,
  ) {}

  /** The link, or the reason this address is no good. Runs under the token and nothing wider. */
  protected async openLink(token: string): Promise<ProgramLinkTarget> {
    const link = await this.transactions.run(
      () => this.programLinks.findByToken(token),
      { programToken: token },
    );
    if (!link) {
      throw new ProgramLinkNotFoundException();
    }
    return link;
  }

  /** A client who has since been removed has no program: to the person with the address, there is none. */
  protected async clientOf(link: ProgramLinkTarget): Promise<ClientRecord> {
    try {
      return await this.transactions.run(
        () => this.clients.findOne(link.workspaceId, link.clientId),
        { workspaceId: link.workspaceId },
      );
    } catch (error) {
      throw error instanceof ClientNotFoundException
        ? new ProgramLinkNotFoundException()
        : error;
    }
  }

  protected refuseWhenLocked(link: ProgramLinkTarget): void {
    if (this.lockPolicy.statusOf(link, new Date()).outcome === 'locked') {
      throw new ProgramLockedException();
    }
  }

  /**
   * One more wrong try. Written in its own transaction and before the refusal is thrown, because a
   * thrown error would take the write back with it.
   */
  protected recordFailure(link: ProgramLinkTarget): Promise<void> {
    return this.transactions.run(
      () =>
        this.programLinks.recordFailure(
          link.id,
          ProgramLockPolicy.LOCK_AFTER_FAILURES,
          ProgramLockPolicy.LOCK_MINUTES,
        ),
      { workspaceId: link.workspaceId },
    );
  }

  /** What the page greets them with: the client's first name only. */
  protected firstNameOf(client: ClientRecord): string {
    return client.fullName.trim().split(/\s+/)[0] ?? '';
  }

  protected async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await scryptAsync(
      password,
      salt,
      BaseProgramAccessOrchestrator.KEY_LENGTH,
    );
    return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`;
  }

  protected async passwordMatches(
    password: string,
    stored: string,
  ): Promise<boolean> {
    const [scheme, salt, key] = stored.split('$');
    if (scheme !== 'scrypt' || !salt || !key) {
      return false;
    }
    const expected = Buffer.from(key, 'base64url');
    const actual = await scryptAsync(
      password,
      Buffer.from(salt, 'base64url'),
      expected.length,
    );
    return timingSafeEqual(actual, expected);
  }

  protected signSession(link: ProgramLinkTarget): ProgramSessionResult {
    const expiresAt = new Date(
      Date.now() +
        BaseProgramAccessOrchestrator.SESSION_DAYS * 24 * 60 * 60 * 1000,
    );
    const payload: SessionPayload = {
      l: link.id,
      w: link.workspaceId,
      v: link.sessionVersion,
      e: Math.floor(expiresAt.getTime() / 1000),
    };
    const body = `v1.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
    return { session: `${body}.${this.signature(body)}`, expiresAt };
  }

  /** Refuses a session that is missing, forged, expired, for another link, or from before a reset. */
  protected requireSession(
    link: ProgramLinkTarget,
    session: string | undefined,
  ): void {
    const payload = session ? this.readSession(session) : null;
    if (
      !payload ||
      payload.l !== link.id ||
      payload.w !== link.workspaceId ||
      payload.v !== link.sessionVersion ||
      payload.e * 1000 <= Date.now()
    ) {
      throw new ProgramSessionRequiredException();
    }
  }

  private readSession(session: string): SessionPayload | null {
    const [version, payload, signature, extra] = session.split('.');
    if (version !== 'v1' || !payload || !signature || extra !== undefined) {
      return null;
    }
    const expected = Buffer.from(this.signature(`v1.${payload}`));
    const actual = Buffer.from(signature);
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      return null;
    }
    try {
      return JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as SessionPayload;
    } catch {
      return null;
    }
  }

  private signature(body: string): string {
    return createHmac(
      'sha256',
      this.config.get('PROGRAM_SESSION_SECRET', { infer: true }),
    )
      .update(body)
      .digest('base64url');
  }
}
