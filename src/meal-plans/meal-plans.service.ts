import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../common/handlers/base-query.handler';
import type {
  MealInput,
  MealPlanChanges,
  MealPlanListFilter,
  MealPlanRecord,
  MealPlanSummary,
  NewMealPlan,
} from './interfaces/meal-plan.interface';
import { MealPlanActivationOrchestrator } from './orchestration/meal-plan-activation.orchestrator';
import { MealPlanCreationOrchestrator } from './orchestration/meal-plan-creation.orchestrator';
import { MealPlanDetailsOrchestrator } from './orchestration/meal-plan-details.orchestrator';
import { MealPlanEndingOrchestrator } from './orchestration/meal-plan-ending.orchestrator';
import { MealPlanListOrchestrator } from './orchestration/meal-plan-list.orchestrator';
import { MealPlanRemovalOrchestrator } from './orchestration/meal-plan-removal.orchestrator';
import { MealPlanStructureOrchestrator } from './orchestration/meal-plan-structure.orchestrator';
import { MealPlanTemplateSavingOrchestrator } from './orchestration/meal-plan-template-saving.orchestrator';
import { MealPlanUpdateOrchestrator } from './orchestration/meal-plan-update.orchestrator';
import { StarterMealPlansOrchestrator } from './orchestration/starter-meal-plans.orchestrator';

/** The meal plans module's interface: the nutrition plans coaches build and clients follow. */
@Injectable()
export class MealPlansService {
  constructor(
    private readonly creation: MealPlanCreationOrchestrator,
    private readonly listing: MealPlanListOrchestrator,
    private readonly details: MealPlanDetailsOrchestrator,
    private readonly update: MealPlanUpdateOrchestrator,
    private readonly structure: MealPlanStructureOrchestrator,
    private readonly activation: MealPlanActivationOrchestrator,
    private readonly ending: MealPlanEndingOrchestrator,
    private readonly templateSaving: MealPlanTemplateSavingOrchestrator,
    private readonly removal: MealPlanRemovalOrchestrator,
    private readonly starterPlans: StarterMealPlansOrchestrator,
  ) {}

  create(
    workspaceId: string,
    createdBy: string,
    plan: NewMealPlan,
  ): Promise<MealPlanRecord> {
    return this.creation.execute(workspaceId, createdBy, plan);
  }

  list(
    workspaceId: string,
    filter: MealPlanListFilter,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<MealPlanSummary>> {
    return this.listing.execute(workspaceId, filter, page, limit);
  }

  findOne(workspaceId: string, planId: string): Promise<MealPlanRecord> {
    return this.details.execute(workspaceId, planId);
  }

  updateDetails(
    workspaceId: string,
    planId: string,
    changes: MealPlanChanges,
  ): Promise<MealPlanRecord> {
    return this.update.execute(workspaceId, planId, changes);
  }

  replaceMeals(
    workspaceId: string,
    planId: string,
    meals: MealInput[],
  ): Promise<MealPlanRecord> {
    return this.structure.execute(workspaceId, planId, meals);
  }

  activate(
    workspaceId: string,
    planId: string,
    startsOn?: string,
  ): Promise<MealPlanRecord> {
    return this.activation.execute(workspaceId, planId, startsOn);
  }

  end(workspaceId: string, planId: string): Promise<MealPlanRecord> {
    return this.ending.execute(workspaceId, planId);
  }

  saveAsTemplate(
    workspaceId: string,
    createdBy: string,
    planId: string,
    name: string,
  ): Promise<MealPlanRecord> {
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
