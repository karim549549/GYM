import { RequireAction } from '../common/decorators/require-action.decorator';
import { WorkspaceAction } from '../members/enums/workspace-action.enum';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { Principal } from '../auth/interfaces/principal.interface';
import { CurrentPrincipal } from '../common/decorators/current-principal.decorator';
import { CurrentWorkspaceId } from '../common/decorators/current-workspace-id.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { PaginatedResponse } from '../common/handlers/base-query.handler';
import { CheckinsService } from './checkins.service';
import { CheckinParamsDto } from './dto/checkin-params.dto';
import { ListCheckinsQueryDto } from './dto/list-checkins.query.dto';
import { ReplyCheckinDto } from './dto/reply-checkin.dto';
import { SetCheckinScheduleDto } from './dto/set-checkin-schedule.dto';
import type {
  CheckinRecord,
  CheckinScheduleRecord,
  ClientCheckinSchedule,
  QuietClient,
} from './interfaces/checkin.interface';

/** What a coach does with a client's check-ins. */
@Controller()
export class CheckinsController {
  constructor(private readonly checkins: CheckinsService) {}

  @RequireAction(WorkspaceAction.CHECKIN_SCHEDULES_MANAGE)
  @Put('clients/:id/checkin-schedule')
  setSchedule(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: CheckinParamsDto,
    @Body() dto: SetCheckinScheduleDto,
  ): Promise<CheckinScheduleRecord> {
    return this.checkins.setSchedule(workspaceId, params.id, dto);
  }

  @RequireAction(WorkspaceAction.CHECKIN_SCHEDULES_MANAGE)
  @Get('clients/:id/checkin-schedule')
  findSchedule(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: CheckinParamsDto,
  ): Promise<CheckinScheduleRecord> {
    return this.checkins.findSchedule(workspaceId, params.id);
  }

  @RequireAction(WorkspaceAction.CHECKIN_SCHEDULES_MANAGE)
  @Delete('clients/:id/checkin-schedule')
  @HttpCode(204)
  stopSchedule(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: CheckinParamsDto,
  ): Promise<void> {
    return this.checkins.stopSchedule(workspaceId, params.id);
  }

  @RequireAction(WorkspaceAction.CHECKIN_SCHEDULES_MANAGE)
  @Get('checkin-schedules')
  listSchedules(
    @CurrentWorkspaceId() workspaceId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponse<ClientCheckinSchedule>> {
    return this.checkins.listSchedules(workspaceId, query.page, query.limit);
  }

  @RequireAction(WorkspaceAction.HEALTH_DATA_READ)
  @Get('checkins')
  list(
    @CurrentWorkspaceId() workspaceId: string,
    @Query() query: ListCheckinsQueryDto,
  ): Promise<PaginatedResponse<CheckinRecord>> {
    const { page, limit, needsReply, ...filter } = query;
    return this.checkins.list(
      workspaceId,
      { ...filter, needsReply: needsReply === 'true' || undefined },
      page,
      limit,
    );
  }

  // declared before ':id' so that "at-risk" is not read as an id
  @RequireAction(WorkspaceAction.CLIENTS_READ)
  @Get('checkins/at-risk')
  atRisk(
    @CurrentWorkspaceId() workspaceId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponse<QuietClient>> {
    return this.checkins.atRisk(workspaceId, query.page, query.limit);
  }

  @RequireAction(WorkspaceAction.HEALTH_DATA_READ)
  @Get('checkins/:id')
  findOne(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: CheckinParamsDto,
  ): Promise<CheckinRecord> {
    return this.checkins.findOne(workspaceId, params.id);
  }

  @RequireAction(WorkspaceAction.COACHING_WRITE)
  @Post('checkins/:id/reply')
  reply(
    @CurrentWorkspaceId() workspaceId: string,
    @CurrentPrincipal() principal: Principal,
    @Param() params: CheckinParamsDto,
    @Body() dto: ReplyCheckinDto,
  ): Promise<CheckinRecord> {
    return this.checkins.reply(
      workspaceId,
      principal.personId,
      params.id,
      dto.text,
    );
  }
}
