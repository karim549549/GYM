import { RequireAction } from '../common/decorators/require-action.decorator';
import { WorkspaceAction } from '../members/enums/workspace-action.enum';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { Principal } from '../auth/interfaces/principal.interface';
import { CurrentPrincipal } from '../common/decorators/current-principal.decorator';
import { CurrentWorkspaceId } from '../common/decorators/current-workspace-id.decorator';
import type { PaginatedResponse } from '../common/handlers/base-query.handler';
import { ActivatePlanDto } from './dto/activate-plan.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { ListPlansQueryDto } from './dto/list-plans.query.dto';
import { PlanParamsDto } from './dto/plan-params.dto';
import { ReplacePlanDaysDto } from './dto/replace-plan-days.dto';
import { SaveAsTemplateDto } from './dto/save-as-template.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import type { PlanRecord, PlanSummary } from './interfaces/plan.interface';
import { PlansService } from './plans.service';

@Controller('plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @RequireAction(WorkspaceAction.COACHING_WRITE)
  @Post()
  create(
    @CurrentWorkspaceId() workspaceId: string,
    @CurrentPrincipal() principal: Principal,
    @Body() dto: CreatePlanDto,
  ): Promise<PlanRecord> {
    return this.plans.create(workspaceId, principal.personId, dto);
  }

  @RequireAction(WorkspaceAction.COACHING_READ)
  @Get()
  list(
    @CurrentWorkspaceId() workspaceId: string,
    @Query() query: ListPlansQueryDto,
  ): Promise<PaginatedResponse<PlanSummary>> {
    const { page, limit, template, ...filter } = query;
    return this.plans.list(
      workspaceId,
      {
        ...filter,
        isTemplate: template === undefined ? undefined : template === 'true',
      },
      page,
      limit,
    );
  }

  @RequireAction(WorkspaceAction.COACHING_READ)
  @Get(':id')
  findOne(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: PlanParamsDto,
  ): Promise<PlanRecord> {
    return this.plans.findOne(workspaceId, params.id);
  }

  @RequireAction(WorkspaceAction.COACHING_WRITE)
  @Patch(':id')
  update(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: PlanParamsDto,
    @Body() dto: UpdatePlanDto,
  ): Promise<PlanRecord> {
    return this.plans.updateDetails(workspaceId, params.id, dto);
  }

  @RequireAction(WorkspaceAction.COACHING_WRITE)
  @Put(':id/days')
  replaceDays(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: PlanParamsDto,
    @Body() dto: ReplacePlanDaysDto,
  ): Promise<PlanRecord> {
    return this.plans.replaceDays(workspaceId, params.id, dto.days);
  }

  @RequireAction(WorkspaceAction.COACHING_WRITE)
  @Post(':id/activate')
  activate(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: PlanParamsDto,
    @Body() dto: ActivatePlanDto,
  ): Promise<PlanRecord> {
    return this.plans.activate(workspaceId, params.id, dto.startsOn);
  }

  @RequireAction(WorkspaceAction.COACHING_WRITE)
  @Post(':id/end')
  end(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: PlanParamsDto,
  ): Promise<PlanRecord> {
    return this.plans.end(workspaceId, params.id);
  }

  @RequireAction(WorkspaceAction.COACHING_WRITE)
  @Post(':id/save-as-template')
  saveAsTemplate(
    @CurrentWorkspaceId() workspaceId: string,
    @CurrentPrincipal() principal: Principal,
    @Param() params: PlanParamsDto,
    @Body() dto: SaveAsTemplateDto,
  ): Promise<PlanRecord> {
    return this.plans.saveAsTemplate(
      workspaceId,
      principal.personId,
      params.id,
      dto.name,
    );
  }

  @RequireAction(WorkspaceAction.COACHING_WRITE)
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: PlanParamsDto,
  ): Promise<void> {
    return this.plans.remove(workspaceId, params.id);
  }
}
