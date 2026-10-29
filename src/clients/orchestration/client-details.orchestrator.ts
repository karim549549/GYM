import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { ClientNotFoundException } from '../exceptions/client-exceptions';
import { ClientsQueryHandler } from '../handlers/clients-query.handler';
import type { ClientRecord } from '../interfaces/client.interface';

/** Takes over `ClientsService.findOne`. Another coach's client looks exactly like one that is not there. */
@Injectable()
export class ClientDetailsOrchestrator {
  constructor(
    private readonly clientsQuery: ClientsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(workspaceId: string, clientId: string): Promise<ClientRecord> {
    const client = await this.transactions.run(
      () => this.clientsQuery.findById(clientId),
      { workspaceId },
    );
    if (!client) {
      throw new ClientNotFoundException();
    }
    return client;
  }
}
