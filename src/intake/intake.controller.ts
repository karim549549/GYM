import { RequireAction } from '../common/decorators/require-action.decorator';
import { WorkspaceAction } from '../members/enums/workspace-action.enum';
import { Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentWorkspaceId } from '../common/decorators/current-workspace-id.decorator';
import { IntakeClientParamsDto } from './dto/intake-client-params.dto';
import { IntakeService } from './intake.service';
import type {
  IntakeLinkView,
  IntakeResponseView,
} from './interfaces/intake.interface';

/** What a coach does with a client's intake. */
@Controller('clients')
export class IntakeController {
  constructor(private readonly intake: IntakeService) {}

  /** The client's link to the form: the one still open, or a new one. */
  @RequireAction(WorkspaceAction.CLIENTS_WRITE)
  @Post(':id/intake-link')
  createLink(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: IntakeClientParamsDto,
  ): Promise<IntakeLinkView> {
    return this.intake.createLink(workspaceId, params.id);
  }

  @RequireAction(WorkspaceAction.HEALTH_DATA_READ)
  @Get(':id/intake')
  latestAnswers(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: IntakeClientParamsDto,
  ): Promise<IntakeResponseView> {
    return this.intake.latestAnswers(workspaceId, params.id);
  }
}
