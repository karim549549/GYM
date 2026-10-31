import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsService } from '../../clients/clients.service';
import type { Env } from '../../config/env.schema';
import { TransactionManager } from '../../database/transaction.manager';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { ProgramLinksQueryHandler } from '../handlers/program-links-query.handler';
import type { ProgramGateView } from '../interfaces/program-link.interface';
import { ProgramLockPolicy } from '../policies/program-lock.policy';
import { BaseProgramAccessOrchestrator } from './base-program-access.orchestrator';

/**
 * Takes over `ProgramLinksService.gate`: what anyone with the address sees before signing in. Only the
 * coach's brand, the client's first name and whether a password was chosen yet: no plan, no phone.
 */
@Injectable()
export class ProgramGateOrchestrator extends BaseProgramAccessOrchestrator {
  constructor(
    programLinks: ProgramLinksQueryHandler,
    lockPolicy: ProgramLockPolicy,
    clients: ClientsService,
    config: ConfigService<Env, true>,
    transactions: TransactionManager,
    private readonly workspaces: WorkspacesService,
  ) {
    super(programLinks, lockPolicy, clients, config, transactions);
  }

  async execute(token: string): Promise<ProgramGateView> {
    const link = await this.openLink(token);
    const client = await this.clientOf(link);
    const workspace = await this.transactions.run(
      () => this.workspaces.findCurrent(link.workspaceId),
      { workspaceId: link.workspaceId },
    );
    return {
      coach: { brandName: workspace.brandName, logoUrl: workspace.logoUrl },
      client: { firstName: this.firstNameOf(client) },
      hasPassword: link.passwordHash !== null,
    };
  }
}
