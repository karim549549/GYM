import { Controller, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentWorkspaceId } from '../common/decorators/current-workspace-id.decorator';
import { RequireAction } from '../common/decorators/require-action.decorator';
import { WorkspaceAction } from '../members/enums/workspace-action.enum';
import { ProgramClientParamsDto } from './dto/program-client-params.dto';
import type { ProgramLinkView } from './interfaces/program-link.interface';
import { ProgramLinksService } from './program-links.service';

/**
 * What a coach does with a client's program link. Sharing a program is coaching work, so it is for the
 * owner and coaches, not for an assistant.
 */
@Controller('clients')
export class ProgramLinksController {
  constructor(private readonly programLinks: ProgramLinksService) {}

  /** The client's link: the one they have, or a new one the first time. */
  @RequireAction(WorkspaceAction.COACHING_WRITE)
  @Post(':id/program-link')
  @HttpCode(200)
  link(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: ProgramClientParamsDto,
  ): Promise<ProgramLinkView> {
    return this.programLinks.link(workspaceId, params.id);
  }

  /** The client forgot their password: it is cleared and every device is signed out, the address stays. */
  @RequireAction(WorkspaceAction.COACHING_WRITE)
  @Post(':id/program-link/reset-access')
  @HttpCode(200)
  resetAccess(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: ProgramClientParamsDto,
  ): Promise<ProgramLinkView> {
    return this.programLinks.resetAccess(workspaceId, params.id);
  }

  /** A new address; the old one stops working, and the new one asks for a password again. */
  @RequireAction(WorkspaceAction.COACHING_WRITE)
  @Post(':id/program-link/rotate')
  @HttpCode(200)
  rotate(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: ProgramClientParamsDto,
  ): Promise<ProgramLinkView> {
    return this.programLinks.rotate(workspaceId, params.id);
  }
}
