import { Injectable } from '@nestjs/common';
import type { HomeSummary } from './interfaces/home-summary.interface';
import { HomeSummaryOrchestrator } from './orchestration/home-summary.orchestrator';

/** The home module's interface: the coach's first screen. */
@Injectable()
export class HomeService {
  constructor(private readonly homeSummary: HomeSummaryOrchestrator) {}

  summary(workspaceId: string): Promise<HomeSummary> {
    return this.homeSummary.execute(workspaceId);
  }
}
