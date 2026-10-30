import { Injectable } from '@nestjs/common';
import { BillingService } from '../../billing/billing.service';
import { TransactionManager } from '../../database/transaction.manager';
import { MealPlansService } from '../../meal-plans/meal-plans.service';
import { PlansService } from '../../plans/plans.service';
import type {
  CreatedWorkspace,
  NewWorkspace,
} from '../../workspaces/interfaces/workspace.interface';
import { WorkspacesService } from '../../workspaces/workspaces.service';

/**
 * Takes over `OnboardingService.becomeCoach`. This flow owns no data: it asks the workspaces
 * module for the workspace (and its owner), the plans and meal plans modules for the workout and nutrition templates, and the billing module
 * for the free plan every coach begins on, in one transaction so a coach never has half of them.
 */
@Injectable()
export class CoachOnboardingOrchestrator {
  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly plans: PlansService,
    private readonly mealPlans: MealPlansService,
    private readonly billing: BillingService,
    private readonly transactions: TransactionManager,
  ) {}

  execute(coach: NewWorkspace): Promise<CreatedWorkspace> {
    return this.transactions.run(async () => {
      const workspace = await this.workspaces.create(coach);
      await this.plans.seedStarterTemplates(workspace.id);
      await this.mealPlans.seedStarterTemplates(workspace.id);
      await this.billing.startFreePlan(workspace.id);
      return workspace;
    });
  }
}
