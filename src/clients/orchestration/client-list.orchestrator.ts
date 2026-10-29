import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../../common/handlers/base-query.handler';
import { TransactionManager } from '../../database/transaction.manager';
import { ClientsQueryHandler } from '../handlers/clients-query.handler';
import type {
  ClientListFilter,
  ClientRecord,
} from '../interfaces/client.interface';

/** Takes over `ClientsService.list`: a page of the workspace's clients, newest first. */
@Injectable()
export class ClientListOrchestrator {
  constructor(
    private readonly clientsQuery: ClientsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    workspaceId: string,
    filter: ClientListFilter,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<ClientRecord>> {
    return this.transactions.run(
      () => this.clientsQuery.list(filter, page, limit),
      { workspaceId },
    );
  }
}
