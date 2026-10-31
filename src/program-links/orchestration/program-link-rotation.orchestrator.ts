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
 * Takes over `ProgramLinksService.rotate`: the address got out (or the coach wants a fresh start). The
 * old address stops working at once, and the new one asks for a password like a first visit.
 */
@Injectable()
export class ProgramLinkRotationOrchestrator extends BaseProgramLinkOrchestrator {
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
        const rotated = await this.withFreeToken((token) =>
          this.programLinks.rotate(link.id, token),
        );
        return this.view(slug, rotated);
      },
      { workspaceId },
    );
  }
}
