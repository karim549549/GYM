import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { ClientNotFoundException } from '../exceptions/client-exceptions';
import { ClientsQueryHandler } from '../handlers/clients-query.handler';

/** Takes over `ClientsService.remove`: the client is hidden, not destroyed, so their payment history survives. */
@Injectable()
export class ClientRemovalOrchestrator {
  constructor(
    private readonly clientsQuery: ClientsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(workspaceId: string, clientId: string): Promise<void> {
    const removed = await this.transactions.run(
      () => this.clientsQuery.remove(clientId),
      { workspaceId },
    );
    if (!removed) {
      throw new ClientNotFoundException();
    }
  }
}
