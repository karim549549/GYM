import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsService } from '../../clients/clients.service';
import type { Env } from '../../config/env.schema';
import { TransactionManager } from '../../database/transaction.manager';
import { IntakeQueryHandler } from '../handlers/intake-query.handler';
import type { IntakeLinkView } from '../interfaces/intake.interface';

/**
 * Takes over `IntakeService.createLink`. One link stays open per client: asking again while
 * it is open returns it, so a coach cannot lose track of what they sent; once it is used or
 * expired, asking makes a new one, which is how a coach reopens the form.
 */
@Injectable()
export class IntakeLinkCreationOrchestrator {
  // 62 characters, 8 of them: about 47 bits, enough when links also expire, and short enough
  // to look trustworthy in a WhatsApp message
  private static readonly ALPHABET =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  private static readonly TOKEN_LENGTH = 8;
  private static readonly ATTEMPTS = 3;

  constructor(
    private readonly intakeQuery: IntakeQueryHandler,
    private readonly clients: ClientsService,
    private readonly config: ConfigService<Env, true>,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(
    workspaceId: string,
    clientId: string,
  ): Promise<IntakeLinkView> {
    const link = await this.transactions.run(
      async () => {
        await this.clients.findOne(workspaceId, clientId);
        return (
          (await this.intakeQuery.findOpenLinkForClient(clientId)) ??
          this.createWithFreeToken(workspaceId, clientId)
        );
      },
      { workspaceId },
    );
    return { ...link, url: this.urlFor(link.token) };
  }

  /** A token that is taken is retried, each try a savepoint so it cannot spoil the transaction. */
  private async createWithFreeToken(
    workspaceId: string,
    clientId: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.transactions.attempt(() =>
          this.intakeQuery.createLink(workspaceId, clientId, this.newToken()),
        );
      } catch (error) {
        if (
          !this.isTokenTaken(error) ||
          attempt >= IntakeLinkCreationOrchestrator.ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }

  private newToken(): string {
    const { ALPHABET, TOKEN_LENGTH } = IntakeLinkCreationOrchestrator;
    return Array.from(
      { length: TOKEN_LENGTH },
      () => ALPHABET[randomInt(ALPHABET.length)],
    ).join('');
  }

  private urlFor(token: string): string {
    return `${this.config.get('PUBLIC_APP_URL', { infer: true })}/f/${token}`;
  }

  private isTokenTaken(error: unknown): boolean {
    for (
      let link: unknown = error, depth = 0;
      link && depth < 5;
      link = (link as { cause?: unknown }).cause, depth += 1
    ) {
      const { code, constraint } = link as {
        code?: string;
        constraint?: string;
      };
      if (code === '23505' && constraint === 'intake_links_token_unique') {
        return true;
      }
    }
    return false;
  }
}
