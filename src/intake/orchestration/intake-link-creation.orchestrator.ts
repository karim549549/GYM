import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsService } from '../../clients/clients.service';
import type { Env } from '../../config/env.schema';
import { TransactionManager } from '../../database/transaction.manager';
import { FormTemplateNotFoundException } from '../../forms/exceptions/form-exceptions';
import { FormPurpose } from '../../forms/enums/form-purpose.enum';
import { FormsService } from '../../forms/forms.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { IntakeQueryHandler } from '../handlers/intake-query.handler';
import type { IntakeLinkView } from '../interfaces/intake.interface';

/**
 * Takes over `IntakeService.createLink`. One link stays open per client: asking again while
 * it is open returns it, so a coach cannot lose track of what they sent; once it is used or
 * expired, asking makes a new one, which is how a coach reopens the form. A link can pin one of the
 * coach's named forms (`null` goes back to their default form); leaving it out keeps what the link asks.
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
    private readonly forms: FormsService,
    private readonly workspaces: WorkspacesService,
  ) {}

  async execute(
    workspaceId: string,
    clientId: string,
    namedFormId?: string | null,
  ): Promise<IntakeLinkView> {
    const { link, handle } = await this.transactions.run(
      async () => {
        await this.clients.findOne(workspaceId, clientId);
        const { slug: handle } = await this.workspaces.findCurrent(workspaceId);
        if (namedFormId) {
          const named = await this.forms.namedForm(workspaceId, namedFormId);
          if (named.purpose !== FormPurpose.INTAKE) {
            throw new FormTemplateNotFoundException();
          }
        }
        const open = await this.intakeQuery.findOpenLinkForClient(clientId);
        if (!open) {
          return {
            handle,
            link: await this.createWithFreeToken(
              workspaceId,
              clientId,
              namedFormId ?? null,
            ),
          };
        }
        if (namedFormId !== undefined && namedFormId !== open.namedFormId) {
          await this.intakeQuery.pinLink(open.id, namedFormId);
          return { handle, link: { ...open, namedFormId } };
        }
        return { handle, link: open };
      },
      { workspaceId },
    );
    return {
      token: link.token,
      expiresAt: link.expiresAt,
      namedFormId: link.namedFormId ?? null,
      url: this.urlFor(handle, link.token),
    };
  }

  /** A token that is taken is retried, each try a savepoint so it cannot spoil the transaction. */
  private async createWithFreeToken(
    workspaceId: string,
    clientId: string,
    namedFormId: string | null,
    attempt = 1,
  ): Promise<{ token: string; expiresAt: Date; namedFormId: string | null }> {
    try {
      return await this.transactions.attempt(() =>
        this.intakeQuery.createLink(
          workspaceId,
          clientId,
          this.newToken(),
          namedFormId,
        ),
      );
    } catch (error) {
      if (
        !this.isTokenTaken(error) ||
        attempt >= IntakeLinkCreationOrchestrator.ATTEMPTS
      ) {
        throw error;
      }
      return this.createWithFreeToken(
        workspaceId,
        clientId,
        namedFormId,
        attempt + 1,
      );
    }
  }

  private newToken(): string {
    const { ALPHABET, TOKEN_LENGTH } = IntakeLinkCreationOrchestrator;
    return Array.from(
      { length: TOKEN_LENGTH },
      () => ALPHABET[randomInt(ALPHABET.length)],
    ).join('');
  }

  /** `/intake/<workspace handle>/<token>`: the handle is only for looks, the token is the key. */
  private urlFor(handle: string, token: string): string {
    return `${this.config.get('PUBLIC_APP_URL', { infer: true })}/intake/${handle}/${token}`;
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
