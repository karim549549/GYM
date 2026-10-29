import { RequireAction } from '../common/decorators/require-action.decorator';
import { WorkspaceAction } from '../members/enums/workspace-action.enum';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentWorkspaceId } from '../common/decorators/current-workspace-id.decorator';
import {
  ImageUploadPipe,
  type UploadedFile as Upload,
} from '../common/pipes/image-upload.pipe';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import type { WorkspaceDetails } from './interfaces/workspace.interface';
import { WorkspacesService } from './workspaces.service';

// A logo is shown small, so 2 MB is generous. The upload parser stops reading at this size.
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @RequireAction(WorkspaceAction.MEMBER)
  @Get('current')
  findCurrent(
    @CurrentWorkspaceId() workspaceId: string,
  ): Promise<WorkspaceDetails> {
    return this.workspaces.findCurrent(workspaceId);
  }

  @RequireAction(WorkspaceAction.WORKSPACE_SETTINGS)
  @Patch('current')
  updateCurrent(
    @CurrentWorkspaceId() workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceDetails> {
    return this.workspaces.updateCurrent(workspaceId, dto);
  }

  /** Replaces the logo. Send the image as the `file` field of a multipart form. */
  @RequireAction(WorkspaceAction.WORKSPACE_SETTINGS)
  @Put('current/logo')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: LOGO_MAX_BYTES, files: 1 } }),
  )
  setLogo(
    @CurrentWorkspaceId() workspaceId: string,
    @UploadedFile(new ImageUploadPipe({ maxBytes: LOGO_MAX_BYTES }))
    file: Upload,
  ): Promise<{ logoUrl: string }> {
    return this.workspaces.setLogo(workspaceId, file.buffer);
  }

  @RequireAction(WorkspaceAction.WORKSPACE_SETTINGS)
  @Delete('current/logo')
  @HttpCode(204)
  removeLogo(@CurrentWorkspaceId() workspaceId: string): Promise<void> {
    return this.workspaces.removeLogo(workspaceId);
  }
}
