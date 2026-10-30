import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../common/handlers/base-query.handler';
import type { ClientListFilter } from '../clients/interfaces/client.interface';
import type { ClientOverview } from './interfaces/client-overview.interface';
import { ClientOverviewListOrchestrator } from './orchestration/client-overview-list.orchestrator';

/** The client overview module's interface: clients together with what other modules know about them. Owns no table. */
@Injectable()
export class ClientOverviewService {
  constructor(private readonly listing: ClientOverviewListOrchestrator) {}

  list(
    workspaceId: string,
    filter: ClientListFilter,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<ClientOverview>> {
    return this.listing.execute(workspaceId, filter, page, limit);
  }
}
