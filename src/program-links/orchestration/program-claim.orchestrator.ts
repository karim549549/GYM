import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsService } from '../../clients/clients.service';
import type { Env } from '../../config/env.schema';
import { TransactionManager } from '../../database/transaction.manager';
import {
  ProgramAlreadyClaimedException,
  ProgramCredentialsInvalidException,
} from '../exceptions/program-link-exceptions';
import { ProgramLinksQueryHandler } from '../handlers/program-links-query.handler';
import type { ProgramSessionResult } from '../interfaces/program-link.interface';
import { ProgramLockPolicy } from '../policies/program-lock.policy';
import { BaseProgramAccessOrchestrator } from './base-program-access.orchestrator';

/**
 * Takes over `ProgramLinksService.claim`: the first visit. The client types the mobile number the coach
 * has for them and chooses a password; from then on the address asks for it. A wrong number counts as a
 * wrong try, so the first visit cannot be used to guess numbers freely.
 */
@Injectable()
export class ProgramClaimOrchestrator extends BaseProgramAccessOrchestrator {
  constructor(
    programLinks: ProgramLinksQueryHandler,
    lockPolicy: ProgramLockPolicy,
    clients: ClientsService,
    config: ConfigService<Env, true>,
    transactions: TransactionManager,
  ) {
    super(programLinks, lockPolicy, clients, config, transactions);
  }

  async execute(
    token: string,
    phone: string,
    password: string,
  ): Promise<ProgramSessionResult> {
    const link = await this.openLink(token);
    this.refuseWhenLocked(link);
    if (link.passwordHash !== null) {
      throw new ProgramAlreadyClaimedException();
    }

    const client = await this.clientOf(link);
    if (client.phone !== phone) {
      await this.recordFailure(link);
      throw new ProgramCredentialsInvalidException();
    }

    const passwordHash = await this.hashPassword(password);
    const claimed = await this.transactions.run(
      () => this.programLinks.setPassword(link.id, passwordHash),
      { workspaceId: link.workspaceId },
    );
    if (!claimed) {
      throw new ProgramAlreadyClaimedException();
    }
    return this.signSession(link);
  }
}
