import { RequireAction } from '../common/decorators/require-action.decorator';
import { WorkspaceAction } from '../members/enums/workspace-action.enum';
import { Controller, Get, Param } from '@nestjs/common';
import { CurrentWorkspaceId } from '../common/decorators/current-workspace-id.decorator';
import { AnalyticsService } from './analytics.service';
import { ProgressParamsDto } from './dto/progress-params.dto';
import type {
  BusinessAnalytics,
  ClientProgress,
} from './interfaces/analytics.interface';

@Controller()
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** The page that makes a client feel progress: their weight, measurements and how closely they followed. */
  @RequireAction(WorkspaceAction.HEALTH_DATA_READ)
  @Get('clients/:id/progress')
  clientProgress(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: ProgressParamsDto,
  ): Promise<ClientProgress> {
    return this.analytics.clientProgress(workspaceId, params.id);
  }

  /** The coach's work as a business: revenue, clients, renewals, who is at risk. */
  @RequireAction(WorkspaceAction.BUSINESS_ANALYTICS)
  @Get('analytics/business')
  business(
    @CurrentWorkspaceId() workspaceId: string,
  ): Promise<BusinessAnalytics> {
    return this.analytics.business(workspaceId);
  }
}
