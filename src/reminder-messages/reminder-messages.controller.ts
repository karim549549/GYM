import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { CurrentWorkspaceId } from '../common/decorators/current-workspace-id.decorator';
import { RequireAction } from '../common/decorators/require-action.decorator';
import { WorkspaceAction } from '../members/enums/workspace-action.enum';
import { ReminderMessageParamsDto } from './dto/reminder-message-params.dto';
import { SaveReminderMessageDto } from './dto/save-reminder-message.dto';
import type { ReminderMessageRecord } from './interfaces/reminder-message.interface';
import { ReminderMessagesService } from './reminder-messages.service';

@Controller('reminder-messages')
export class ReminderMessagesController {
  constructor(private readonly messages: ReminderMessagesService) {}

  /** Only the kinds the coach has written; the others use the app's default wording. */
  @RequireAction(WorkspaceAction.MEMBER)
  @Get()
  list(
    @CurrentWorkspaceId() workspaceId: string,
  ): Promise<ReminderMessageRecord[]> {
    return this.messages.list(workspaceId);
  }

  @RequireAction(WorkspaceAction.WORKSPACE_SETTINGS)
  @Put(':kind')
  save(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: ReminderMessageParamsDto,
    @Body() dto: SaveReminderMessageDto,
  ): Promise<ReminderMessageRecord> {
    return this.messages.save(workspaceId, params.kind, dto.body);
  }
}
