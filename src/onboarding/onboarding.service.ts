import { Injectable } from '@nestjs/common';
import type {
  CreatedWorkspace,
  NewWorkspace,
} from '../workspaces/interfaces/workspace.interface';
import { CoachOnboardingOrchestrator } from './orchestration/coach-onboarding.orchestrator';

/** The onboarding module's interface: the steps that turn a signed-in person into a coach. */
@Injectable()
export class OnboardingService {
  constructor(private readonly coachOnboarding: CoachOnboardingOrchestrator) {}

  becomeCoach(coach: NewWorkspace): Promise<CreatedWorkspace> {
    return this.coachOnboarding.execute(coach);
  }
}
