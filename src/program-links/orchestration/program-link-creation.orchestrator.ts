import { Injectable } from '@nestjs/common';
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
import { BaseProgramLinkOrchestrator } from './base-program-link.orchestrator';

/**
 * Takes over `ProgramLinksService.link`: the client's program link. A client has one for good, so asking
 * again returns it; the coach changes it with a reset, never by asking for another.
 */
@Injectable()
export class ProgramLinkCreationOrchestrator extends BaseProgramLinkOrchestrator {
  constructor(
    programLinks: ProgramLinksQueryHandler,
    clients: ClientsService,
    workspaces: WorkspacesService,
    config: ConfigService<Env, true>,
    transactions: TransactionManager,
  ) {
    super(programLinks, clients, workspaces, config, transactions);
  }

  execute(workspaceId: string, clientId: string): Promise<ProgramLinkView> {
    return this.transactions.run(
      async () => {
        await this.clients.findOne(workspaceId, clientId);
        const { slug } = await this.workspaces.findCurrent(workspaceId);
        const link =
          (await this.programLinks.findByClient(clientId)) ??
          (await this.create(workspaceId, clientId));
        return this.view(slug, link);
      },
      { workspaceId },
    );
  }

  /** Two first requests at once: the database lets one make the link, and the other reads it. */
  private async create(
    workspaceId: string,
    clientId: string,
  ): Promise<ProgramLinkTarget> {
    try {
      return await this.withFreeToken((token) =>
        this.programLinks.create(workspaceId, clientId, token),
      );
    } catch (error) {
      const existing = this.violates(error, 'program_links_client_unique')
        ? await this.programLinks.findByClient(clientId)
        : null;
      if (!existing) {
        throw error;
      }
      return existing;
    }
  }
}
