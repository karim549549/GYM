import { ClientsService } from '../../clients/clients.service';
import type { ClientRecord } from '../../clients/interfaces/client.interface';
import { ClientNotFoundException } from '../../clients/exceptions/client-exceptions';
import { TransactionManager } from '../../database/transaction.manager';
import {
  IntakeAlreadySubmittedException,
  IntakeLinkExpiredException,
  IntakeLinkNotFoundException,
} from '../exceptions/intake-exceptions';
import { IntakeQueryHandler } from '../handlers/intake-query.handler';
import type { IntakeLinkTarget } from '../interfaces/intake.interface';
import { IntakeLinkPolicy } from '../policies/intake-link.policy';

/**
 * What the two public flows (opening the form, handing it in) share: finding the link by the
 * secret in its address, and refusing it unless it can still be used. Nobody is signed in,
 * so the token is the only credential, and the lookup runs under it and nothing wider.
 */
export abstract class BasePublicIntakeOrchestrator {
  constructor(
    protected readonly intakeQuery: IntakeQueryHandler,
    protected readonly linkPolicy: IntakeLinkPolicy,
    protected readonly clients: ClientsService,
    protected readonly transactions: TransactionManager,
  ) {}

  /** The link and its client, or the reason this link is no good. */
  protected async openLink(
    token: string,
  ): Promise<{ link: IntakeLinkTarget; client: ClientRecord }> {
    const link = await this.transactions.run(
      () => this.intakeQuery.findLinkByToken(token),
      { intakeToken: token },
    );
    if (!link) {
      throw new IntakeLinkNotFoundException();
    }

    const status = this.linkPolicy.statusOf(link, new Date());
    if (status.outcome === 'expired') {
      throw new IntakeLinkExpiredException();
    }
    if (status.outcome === 'submitted') {
      throw new IntakeAlreadySubmittedException();
    }

    return { link, client: await this.clientOf(link) };
  }

  /** A client who has since been removed has no form to fill in: to the person with the link, there is none. */
  private async clientOf(link: IntakeLinkTarget): Promise<ClientRecord> {
    try {
      return await this.transactions.run(
        () => this.clients.findOne(link.workspaceId, link.clientId),
        { workspaceId: link.workspaceId },
      );
    } catch (error) {
      throw error instanceof ClientNotFoundException
        ? new IntakeLinkNotFoundException()
        : error;
    }
  }
}
