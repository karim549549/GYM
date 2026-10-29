import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PeopleService } from '../../people/people.service';
import { ClientAlreadyExistsException } from '../exceptions/client-exceptions';
import { ClientsQueryHandler } from '../handlers/clients-query.handler';
import type { ClientRecord, NewClient } from '../interfaces/client.interface';

/**
 * Takes over `ClientsService.create`. A coach may type the number of someone who has already
 * signed up, so the client is linked to that person; and one who was removed comes back
 * rather than being made twice. Which person a number belongs to is the people module's to say.
 */
@Injectable()
export class ClientCreationOrchestrator {
  constructor(
    private readonly clientsQuery: ClientsQueryHandler,
    private readonly people: PeopleService,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(workspaceId: string, client: NewClient): Promise<ClientRecord> {
    try {
      return await this.transactions.run(
        async () => {
          const existing = await this.clientsQuery.findByPhoneIncludingRemoved(
            client.phone,
          );
          if (existing && !existing.removed) {
            throw new ClientAlreadyExistsException();
          }

          const personId =
            (await this.people.findByPhone(client.phone))?.id ?? null;
          return existing
            ? this.clientsQuery.restore(existing.id, {
                fullName: client.fullName,
                personId,
              })
            : this.clientsQuery.create(workspaceId, client, personId);
        },
        { workspaceId },
      );
    } catch (error) {
      // two requests can pass the check together; the database's rule is the last word
      throw ClientAlreadyExistsException.causes(error)
        ? new ClientAlreadyExistsException()
        : error;
    }
  }
}
