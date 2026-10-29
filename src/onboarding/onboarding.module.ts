import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { MealPlansModule } from '../meal-plans/meal-plans.module';
import { PackagesModule } from '../packages/packages.module';
import { PlansModule } from '../plans/plans.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { CoachOnboardingOrchestrator } from './orchestration/coach-onboarding.orchestrator';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [
    WorkspacesModule,
    PackagesModule,
    PlansModule,
    MealPlansModule,
    BillingModule,
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService, CoachOnboardingOrchestrator],
})
export class OnboardingModule {}
