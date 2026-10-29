import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PeopleService } from '../../people/people.service';
import {
  ClientAlreadyExistsException,
  ClientNotFoundException,
} from '../exceptions/client-exceptions';
import { ClientsQueryHandler } from '../handlers/clients-query.handler';
import type {
  ClientChanges,
  ClientRecord,
} from '../interfaces/client.interface';

/** Takes over `ClientsService.update`: change what was sent. The link to a person follows the number. */
@Injectable()
export class ClientUpdateOrchestrator {
  constructor(
    private readonly clientsQuery: ClientsQueryHandler,
    private readonly people: PeopleService,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(
    workspaceId: string,
    clientId: string,
    changes: Pick<ClientChanges, 'fullName' | 'phone'>,
  ): Promise<ClientRecord> {
    let client: ClientRecord | null;
    try {
      client = await this.transactions.run(
        async () => {
          if (changes.fullName === undefined && changes.phone === undefined) {
            return this.clientsQuery.findById(clientId);
          }
          const update: ClientChanges = { ...changes };
          if (changes.phone !== undefined) {
            update.personId =
              (await this.people.findByPhone(changes.phone))?.id ?? null;
          }
          return this.clientsQuery.update(clientId, update);
        },
        { workspaceId },
      );
    } catch (error) {
      throw ClientAlreadyExistsException.causes(error)
        ? new ClientAlreadyExistsException()
        : error;
    }

    if (!client) {
      throw new ClientNotFoundException();
    }
    return client;
  }
}
