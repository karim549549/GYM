import { RequireAction } from '../common/decorators/require-action.decorator';
import { WorkspaceAction } from '../members/enums/workspace-action.enum';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentWorkspaceId } from '../common/decorators/current-workspace-id.decorator';
import type { PaginatedResponse } from '../common/handlers/base-query.handler';
import { CreateFoodDto } from './dto/create-food.dto';
import { FoodParamsDto } from './dto/food-params.dto';
import { ListFoodsQueryDto } from './dto/list-foods.query.dto';
import { UpdateFoodDto } from './dto/update-food.dto';
import { FoodsService } from './foods.service';
import type { FoodRecord } from './interfaces/food.interface';

@Controller('foods')
export class FoodsController {
  constructor(private readonly foods: FoodsService) {}

  @RequireAction(WorkspaceAction.COACHING_READ)
  @Get()
  list(
    @CurrentWorkspaceId() workspaceId: string,
    @Query() query: ListFoodsQueryDto,
  ): Promise<PaginatedResponse<FoodRecord>> {
    const { page, limit, q, includeInactive, ...filter } = query;
    return this.foods.list(
      workspaceId,
      { ...filter, search: q, includeInactive: includeInactive === 'true' },
      page,
      limit,
    );
  }

  @RequireAction(WorkspaceAction.COACHING_READ)
  @Get(':id')
  findOne(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: FoodParamsDto,
  ): Promise<FoodRecord> {
    return this.foods.findOne(workspaceId, params.id);
  }

  @RequireAction(WorkspaceAction.COACHING_WRITE)
  @Post()
  create(
    @CurrentWorkspaceId() workspaceId: string,
    @Body() dto: CreateFoodDto,
  ): Promise<FoodRecord> {
    return this.foods.create(workspaceId, dto);
  }

  @RequireAction(WorkspaceAction.COACHING_WRITE)
  @Patch(':id')
  update(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: FoodParamsDto,
    @Body() dto: UpdateFoodDto,
  ): Promise<FoodRecord> {
    return this.foods.update(workspaceId, params.id, dto);
  }
}
