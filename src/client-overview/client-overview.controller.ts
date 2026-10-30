import { Controller, Get, Query } from '@nestjs/common';
import { CurrentWorkspaceId } from '../common/decorators/current-workspace-id.decorator';
import { RequireAction } from '../common/decorators/require-action.decorator';
import type { PaginatedResponse } from '../common/handlers/base-query.handler';
import { WorkspaceAction } from '../members/enums/workspace-action.enum';
import { ClientOverviewService } from './client-overview.service';
import { ListClientsQueryDto } from './dto/list-clients.query.dto';
import type { ClientOverview } from './interfaces/client-overview.interface';

@Controller('clients')
export class ClientOverviewController {
  constructor(private readonly overview: ClientOverviewService) {}

  /** The workspace's clients, newest first, each with its subscription, plan and check-in summary. */
  @RequireAction(WorkspaceAction.CLIENTS_READ)
  @Get()
  list(
    @CurrentWorkspaceId() workspaceId: string,
    @Query() query: ListClientsQueryDto,
  ): Promise<PaginatedResponse<ClientOverview>> {
    const { page, limit, ...filter } = query;
    return this.overview.list(workspaceId, filter, page, limit);
  }
}
