import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../common/handlers/base-query.handler';
import type { IntakeStatus } from './enums/intake-status.enum';
import type {
  ClientChanges,
  ClientListFilter,
  ClientRecord,
  NewClient,
} from './interfaces/client.interface';
import { ClientCreationOrchestrator } from './orchestration/client-creation.orchestrator';
import { ClientCountOrchestrator } from './orchestration/client-count.orchestrator';
import { ClientDetailsOrchestrator } from './orchestration/client-details.orchestrator';
import { ClientIntakeStatusOrchestrator } from './orchestration/client-intake-status.orchestrator';
import { ClientListOrchestrator } from './orchestration/client-list.orchestrator';
import { ClientRemovalOrchestrator } from './orchestration/client-removal.orchestrator';
import { ClientUpdateOrchestrator } from './orchestration/client-update.orchestrator';

/** The clients module's interface: the people a coach trains. */
@Injectable()
export class ClientsService {
  constructor(
    private readonly clientCreation: ClientCreationOrchestrator,
    private readonly clientDetails: ClientDetailsOrchestrator,
    private readonly clientList: ClientListOrchestrator,
    private readonly clientUpdate: ClientUpdateOrchestrator,
    private readonly clientRemoval: ClientRemovalOrchestrator,
    private readonly clientIntakeStatus: ClientIntakeStatusOrchestrator,
    private readonly clientCount: ClientCountOrchestrator,
  ) {}

  create(workspaceId: string, client: NewClient): Promise<ClientRecord> {
    return this.clientCreation.execute(workspaceId, client);
  }

  findOne(workspaceId: string, clientId: string): Promise<ClientRecord> {
    return this.clientDetails.execute(workspaceId, clientId);
  }

  list(
    workspaceId: string,
    filter: ClientListFilter,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<ClientRecord>> {
    return this.clientList.execute(workspaceId, filter, page, limit);
  }

  update(
    workspaceId: string,
    clientId: string,
    changes: Pick<ClientChanges, 'fullName' | 'phone'>,
  ): Promise<ClientRecord> {
    return this.clientUpdate.execute(workspaceId, clientId, changes);
  }

  /** How many clients the workspace has, for the plan limit. */
  countActive(workspaceId: string): Promise<number> {
    return this.clientCount.execute(workspaceId);
  }

  /** For the intake to call; a coach cannot set this through the API. */
  setIntakeStatus(
    workspaceId: string,
    clientId: string,
    status: IntakeStatus,
  ): Promise<void> {
    return this.clientIntakeStatus.execute(workspaceId, clientId, status);
  }

  remove(workspaceId: string, clientId: string): Promise<void> {
    return this.clientRemoval.execute(workspaceId, clientId);
  }
}
