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
import { ActivateMealPlanDto } from './dto/activate-meal-plan.dto';
import { CreateMealPlanDto } from './dto/create-meal-plan.dto';
import { ListMealPlansQueryDto } from './dto/list-meal-plans.query.dto';
import { MealPlanParamsDto } from './dto/meal-plan-params.dto';
import { ReplaceMealsDto } from './dto/replace-meals.dto';
import { SaveMealPlanAsTemplateDto } from './dto/save-meal-plan-as-template.dto';
import { UpdateMealPlanDto } from './dto/update-meal-plan.dto';
import type {
  MealPlanRecord,
  MealPlanSummary,
} from './interfaces/meal-plan.interface';
import { MealPlansService } from './meal-plans.service';

@Controller('meal-plans')
export class MealPlansController {
  constructor(private readonly mealPlans: MealPlansService) {}

  @RequireAction(WorkspaceAction.COACHING_WRITE)
  @Post()
  create(
    @CurrentWorkspaceId() workspaceId: string,
    @CurrentPrincipal() principal: Principal,
    @Body() dto: CreateMealPlanDto,
  ): Promise<MealPlanRecord> {
    return this.mealPlans.create(workspaceId, principal.personId, dto);
  }

  @RequireAction(WorkspaceAction.COACHING_READ)
  @Get()
  list(
    @CurrentWorkspaceId() workspaceId: string,
    @Query() query: ListMealPlansQueryDto,
  ): Promise<PaginatedResponse<MealPlanSummary>> {
    const { page, limit, template, ...filter } = query;
    return this.mealPlans.list(
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
    @Param() params: MealPlanParamsDto,
  ): Promise<MealPlanRecord> {
    return this.mealPlans.findOne(workspaceId, params.id);
  }

  @RequireAction(WorkspaceAction.COACHING_WRITE)
  @Patch(':id')
  update(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: MealPlanParamsDto,
    @Body() dto: UpdateMealPlanDto,
  ): Promise<MealPlanRecord> {
    return this.mealPlans.updateDetails(workspaceId, params.id, dto);
  }

  @RequireAction(WorkspaceAction.COACHING_WRITE)
  @Put(':id/meals')
  replaceMeals(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: MealPlanParamsDto,
    @Body() dto: ReplaceMealsDto,
  ): Promise<MealPlanRecord> {
    return this.mealPlans.replaceMeals(workspaceId, params.id, dto.meals);
  }

  @RequireAction(WorkspaceAction.COACHING_WRITE)
  @Post(':id/activate')
  activate(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: MealPlanParamsDto,
    @Body() dto: ActivateMealPlanDto,
  ): Promise<MealPlanRecord> {
    return this.mealPlans.activate(workspaceId, params.id, dto.startsOn);
  }

  @RequireAction(WorkspaceAction.COACHING_WRITE)
  @Post(':id/end')
  end(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: MealPlanParamsDto,
  ): Promise<MealPlanRecord> {
    return this.mealPlans.end(workspaceId, params.id);
  }

  @RequireAction(WorkspaceAction.COACHING_WRITE)
  @Post(':id/save-as-template')
  saveAsTemplate(
    @CurrentWorkspaceId() workspaceId: string,
    @CurrentPrincipal() principal: Principal,
    @Param() params: MealPlanParamsDto,
    @Body() dto: SaveMealPlanAsTemplateDto,
  ): Promise<MealPlanRecord> {
    return this.mealPlans.saveAsTemplate(
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
    @Param() params: MealPlanParamsDto,
  ): Promise<void> {
    return this.mealPlans.remove(workspaceId, params.id);
  }
}
