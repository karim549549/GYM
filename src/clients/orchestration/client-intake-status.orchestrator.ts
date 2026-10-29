import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import type { IntakeStatus } from '../enums/intake-status.enum';
import { ClientNotFoundException } from '../exceptions/client-exceptions';
import { ClientsQueryHandler } from '../handlers/clients-query.handler';

/**
 * Takes over `ClientsService.setIntakeStatus`. Only the intake moves a client along; a coach
 * cannot declare someone's details handed in. It joins the transaction of the intake that
 * calls it, so the status and the answers are saved together.
 */
@Injectable()
export class ClientIntakeStatusOrchestrator {
  constructor(
    private readonly clientsQuery: ClientsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(
    workspaceId: string,
    clientId: string,
    status: IntakeStatus,
  ): Promise<void> {
    const found = await this.transactions.run(
      () => this.clientsQuery.setIntakeStatus(clientId, status),
      { workspaceId },
    );
    if (!found) {
      throw new ClientNotFoundException();
    }
  }
}
