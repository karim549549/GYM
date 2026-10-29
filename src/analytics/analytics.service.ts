import { Injectable } from '@nestjs/common';
import type {
  BusinessAnalytics,
  ClientProgress,
} from './interfaces/analytics.interface';
import { BusinessAnalyticsOrchestrator } from './orchestration/business-analytics.orchestrator';
import { ClientProgressOrchestrator } from './orchestration/client-progress.orchestrator';

/**
 * The analytics module's interface: three audiences, kept apart. A client's progress is for them and
 * their coach; the coach's business is for the coach alone. It owns no table.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly progress: ClientProgressOrchestrator,
    private readonly businessAnalytics: BusinessAnalyticsOrchestrator,
  ) {}

  clientProgress(
    workspaceId: string,
    clientId: string,
  ): Promise<ClientProgress> {
    return this.progress.execute(workspaceId, clientId);
  }

  business(workspaceId: string): Promise<BusinessAnalytics> {
    return this.businessAnalytics.execute(workspaceId);
  }
}
