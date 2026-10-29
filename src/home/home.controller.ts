import { RequireAction } from '../common/decorators/require-action.decorator';
import { WorkspaceAction } from '../members/enums/workspace-action.enum';
import { Controller, Get } from '@nestjs/common';
import { CurrentWorkspaceId } from '../common/decorators/current-workspace-id.decorator';
import { HomeService } from './home.service';
import type { HomeSummary } from './interfaces/home-summary.interface';

@Controller('home')
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @RequireAction(WorkspaceAction.MEMBER)
  @Get()
  summary(@CurrentWorkspaceId() workspaceId: string): Promise<HomeSummary> {
    return this.home.summary(workspaceId);
  }
}
