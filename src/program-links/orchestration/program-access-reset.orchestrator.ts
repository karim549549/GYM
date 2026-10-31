import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsService } from '../../clients/clients.service';
import type { Env } from '../../config/env.schema';
import { TransactionManager } from '../../database/transaction.manager';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { ProgramLinkNotFoundException } from '../exceptions/program-link-exceptions';
import { ProgramLinksQueryHandler } from '../handlers/program-links-query.handler';
import type { ProgramLinkView } from '../interfaces/program-link.interface';
import { BaseProgramLinkOrchestrator } from './base-program-link.orchestrator';

/**
 * Takes over `ProgramLinksService.resetAccess`: the client forgot their password. It is forgotten, every
 * device is signed out, and the same address asks for a new one on its next visit.
 */
@Injectable()
export class ProgramAccessResetOrchestrator extends BaseProgramLinkOrchestrator {
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
        const link = await this.programLinks.findByClient(clientId);
        if (!link) {
          throw new ProgramLinkNotFoundException();
        }
        await this.programLinks.resetAccess(link.id);
        return this.view(slug, { ...link, passwordHash: null });
      },
      { workspaceId },
    );
  }
}
