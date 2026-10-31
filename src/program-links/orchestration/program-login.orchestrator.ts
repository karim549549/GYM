import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsService } from '../../clients/clients.service';
import type { Env } from '../../config/env.schema';
import { TransactionManager } from '../../database/transaction.manager';
import { ProgramCredentialsInvalidException } from '../exceptions/program-link-exceptions';
import { ProgramLinksQueryHandler } from '../handlers/program-links-query.handler';
import type { ProgramSessionResult } from '../interfaces/program-link.interface';
import { ProgramLockPolicy } from '../policies/program-lock.policy';
import { BaseProgramAccessOrchestrator } from './base-program-access.orchestrator';

/**
 * Takes over `ProgramLinksService.login`: a later visit, or a device that was signed out. The number and
 * the password are both checked before either is blamed, and the refusal is the same for either, so
 * nothing says which one was wrong.
 */
@Injectable()
export class ProgramLoginOrchestrator extends BaseProgramAccessOrchestrator {
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

    const client = await this.clientOf(link);
    const phoneMatches = client.phone === phone;
    const passwordMatches =
      link.passwordHash !== null &&
      (await this.passwordMatches(password, link.passwordHash));
    if (!phoneMatches || !passwordMatches) {
      await this.recordFailure(link);
      throw new ProgramCredentialsInvalidException();
    }

    if (link.failedAttempts > 0) {
      await this.transactions.run(
        () => this.programLinks.clearFailures(link.id),
        { workspaceId: link.workspaceId },
      );
    }
    return this.signSession(link);
  }
}
