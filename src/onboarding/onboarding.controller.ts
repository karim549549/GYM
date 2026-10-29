import { Body, Controller, Post } from '@nestjs/common';
import type { Principal } from '../auth/interfaces/principal.interface';
import { CurrentPrincipal } from '../common/decorators/current-principal.decorator';
import type { CreatedWorkspace } from '../workspaces/interfaces/workspace.interface';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { OnboardingService } from './onboarding.service';

@Controller('workspaces')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  /** The signed-in person becomes a coach: their workspace, with them as its one owner. */
  @Post()
  becomeCoach(
    @CurrentPrincipal() principal: Principal,
    @Body() dto: CreateWorkspaceDto,
  ): Promise<CreatedWorkspace> {
    return this.onboarding.becomeCoach({
      brandName: dto.brandName ?? principal.fullName,
      ownerId: principal.personId,
    });
  }
}
