import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../common/handlers/base-query.handler';
import type {
  NewPlan,
  PlanChanges,
  PlanDayInput,
  PlanListFilter,
  PlanRecord,
  PlanSummary,
} from './interfaces/plan.interface';
import { PlanActivationOrchestrator } from './orchestration/plan-activation.orchestrator';
import { PlanActiveClientsOrchestrator } from './orchestration/plan-active-clients.orchestrator';
import { PlanActiveOfClientOrchestrator } from './orchestration/plan-active-of-client.orchestrator';
import { PlanCreationOrchestrator } from './orchestration/plan-creation.orchestrator';
import { PlanDetailsOrchestrator } from './orchestration/plan-details.orchestrator';
import { PlanEndingOrchestrator } from './orchestration/plan-ending.orchestrator';
import { PlanListOrchestrator } from './orchestration/plan-list.orchestrator';
import { PlanRemovalOrchestrator } from './orchestration/plan-removal.orchestrator';
import { PlanStructureOrchestrator } from './orchestration/plan-structure.orchestrator';
import { PlanTemplateSavingOrchestrator } from './orchestration/plan-template-saving.orchestrator';
import { PlanUpdateOrchestrator } from './orchestration/plan-update.orchestrator';
import { StarterPlansOrchestrator } from './orchestration/starter-plans.orchestrator';

/** The plans module's interface: the workout programs coaches build and clients follow. */
@Injectable()
export class PlansService {
  constructor(
    private readonly creation: PlanCreationOrchestrator,
    private readonly listing: PlanListOrchestrator,
    private readonly details: PlanDetailsOrchestrator,
    private readonly update: PlanUpdateOrchestrator,
    private readonly structure: PlanStructureOrchestrator,
    private readonly activation: PlanActivationOrchestrator,
    private readonly ending: PlanEndingOrchestrator,
    private readonly templateSaving: PlanTemplateSavingOrchestrator,
    private readonly removal: PlanRemovalOrchestrator,
    private readonly starterPlans: StarterPlansOrchestrator,
    private readonly activeClients: PlanActiveClientsOrchestrator,
    private readonly activeOfClient: PlanActiveOfClientOrchestrator,
  ) {}

  /** Which of these clients follow an active plan, for the clients list. */
  clientsWithActivePlan(workspaceId: string, clientIds: string[]): Promise<string[]> {
    return this.activeClients.execute(workspaceId, clientIds);
  }

  create(
    workspaceId: string,
    createdBy: string,
    plan: NewPlan,
  ): Promise<PlanRecord> {
    return this.creation.execute(workspaceId, createdBy, plan);
  }

  list(
    workspaceId: string,
    filter: PlanListFilter,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<PlanSummary>> {
    return this.listing.execute(workspaceId, filter, page, limit);
  }

  findOne(workspaceId: string, planId: string): Promise<PlanRecord> {
    return this.details.execute(workspaceId, planId);
  }

  /** The plan this client follows now, or null when they have none. */
  findActiveOfClient(
    workspaceId: string,
    clientId: string,
  ): Promise<PlanRecord | null> {
    return this.activeOfClient.execute(workspaceId, clientId);
  }

  updateDetails(
    workspaceId: string,
    planId: string,
    changes: PlanChanges,
  ): Promise<PlanRecord> {
    return this.update.execute(workspaceId, planId, changes);
  }

  replaceDays(
    workspaceId: string,
    planId: string,
    days: PlanDayInput[],
  ): Promise<PlanRecord> {
    return this.structure.execute(workspaceId, planId, days);
  }

  activate(
    workspaceId: string,
    planId: string,
    startsOn?: string,
  ): Promise<PlanRecord> {
    return this.activation.execute(workspaceId, planId, startsOn);
  }

  end(workspaceId: string, planId: string): Promise<PlanRecord> {
    return this.ending.execute(workspaceId, planId);
  }

  saveAsTemplate(
    workspaceId: string,
    createdBy: string,
    planId: string,
    name: string,
  ): Promise<PlanRecord> {
    return this.templateSaving.execute(workspaceId, createdBy, planId, name);
  }

  remove(workspaceId: string, planId: string): Promise<void> {
    return this.removal.execute(workspaceId, planId);
  }

  /** For a workspace that has just been created, inside the transaction that created it. */
  seedStarterTemplates(workspaceId: string): Promise<void> {
    return this.starterPlans.execute(workspaceId);
  }
}
