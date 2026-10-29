import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { ClientsQueryHandler } from '../handlers/clients-query.handler';

/** Takes over `ClientsService.countActive`: the workspace's clients, not counting the removed. */
@Injectable()
export class ClientCountOrchestrator {
  constructor(
    private readonly clientsQuery: ClientsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(workspaceId: string): Promise<number> {
    return this.transactions.run(() => this.clientsQuery.countActive(), {
      workspaceId,
    });
  }
}
