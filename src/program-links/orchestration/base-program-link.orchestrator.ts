import { randomInt } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { ClientsService } from '../../clients/clients.service';
import type { Env } from '../../config/env.schema';
import { TransactionManager } from '../../database/transaction.manager';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { ProgramLinksQueryHandler } from '../handlers/program-links-query.handler';
import type {
  ProgramLinkTarget,
  ProgramLinkView,
} from '../interfaces/program-link.interface';

/**
 * What the coach-side flows share: making a token nobody has, and the address the coach sends. The
 * address reads `/program/<workspace handle>/<token>`; the handle is only for looks, the token is the key.
 */
export abstract class BaseProgramLinkOrchestrator {
  // 62 characters, 12 of them: about 71 bits. Longer than the intake link's 8, because this
  // address never expires and shows a training plan
  private static readonly ALPHABET =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  private static readonly TOKEN_LENGTH = 12;
  private static readonly ATTEMPTS = 3;

  constructor(
    protected readonly programLinks: ProgramLinksQueryHandler,
    protected readonly clients: ClientsService,
    protected readonly workspaces: WorkspacesService,
    protected readonly config: ConfigService<Env, true>,
    protected readonly transactions: TransactionManager,
  ) {}

  /** Runs the work with a fresh token. A taken token is retried, each try a savepoint so it cannot spoil the transaction. */
  protected async withFreeToken<T>(
    work: (token: string) => Promise<T>,
    attempt = 1,
  ): Promise<T> {
    try {
      return await this.transactions.attempt(() => work(this.newToken()));
    } catch (error) {
      if (
        !this.violates(error, 'program_links_token_unique') ||
        attempt >= BaseProgramLinkOrchestrator.ATTEMPTS
      ) {
        throw error;
      }
      return this.withFreeToken(work, attempt + 1);
    }
  }

  protected violates(error: unknown, constraintName: string): boolean {
    for (
      let link: unknown = error, depth = 0;
      link && depth < 5;
      link = (link as { cause?: unknown }).cause, depth += 1
    ) {
      const { code, constraint } = link as {
        code?: string;
        constraint?: string;
      };
      if (code === '23505' && constraint === constraintName) {
        return true;
      }
    }
    return false;
  }

  protected view(
    handle: string,
    link: Pick<ProgramLinkTarget, 'token' | 'passwordHash'>,
  ): ProgramLinkView {
    return {
      token: link.token,
      url: `${this.config.get('PUBLIC_APP_URL', { infer: true })}/program/${handle}/${link.token}`,
      hasPassword: link.passwordHash !== null,
    };
  }

  private newToken(): string {
    const { ALPHABET, TOKEN_LENGTH } = BaseProgramLinkOrchestrator;
    return Array.from(
      { length: TOKEN_LENGTH },
      () => ALPHABET[randomInt(ALPHABET.length)],
    ).join('');
  }
}
