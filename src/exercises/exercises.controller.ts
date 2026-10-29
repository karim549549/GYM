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
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { ExerciseParamsDto } from './dto/exercise-params.dto';
import { ListExercisesQueryDto } from './dto/list-exercises.query.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import { ExercisesService } from './exercises.service';
import type {
  ExerciseRecord,
  MuscleRecord,
} from './interfaces/exercise.interface';

@Controller()
export class ExercisesController {
  constructor(private readonly exercises: ExercisesService) {}

  @RequireAction(WorkspaceAction.COACHING_READ)
  @Get('muscles')
  muscles(): Promise<MuscleRecord[]> {
    return this.exercises.muscles();
  }

  @RequireAction(WorkspaceAction.COACHING_READ)
  @Get('exercises')
  list(
    @CurrentWorkspaceId() workspaceId: string,
    @Query() query: ListExercisesQueryDto,
  ): Promise<PaginatedResponse<ExerciseRecord>> {
    const { page, limit, q, includeInactive, ...filter } = query;
    return this.exercises.list(
      workspaceId,
      { ...filter, search: q, includeInactive: includeInactive === 'true' },
      page,
      limit,
    );
  }

  @RequireAction(WorkspaceAction.COACHING_READ)
  @Get('exercises/:id')
  findOne(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: ExerciseParamsDto,
  ): Promise<ExerciseRecord> {
    return this.exercises.findOne(workspaceId, params.id);
  }

  @RequireAction(WorkspaceAction.COACHING_WRITE)
  @Post('exercises')
  create(
    @CurrentWorkspaceId() workspaceId: string,
    @Body() dto: CreateExerciseDto,
  ): Promise<ExerciseRecord> {
    return this.exercises.create(workspaceId, dto);
  }

  @RequireAction(WorkspaceAction.COACHING_WRITE)
  @Patch('exercises/:id')
  update(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: ExerciseParamsDto,
    @Body() dto: UpdateExerciseDto,
  ): Promise<ExerciseRecord> {
    return this.exercises.update(workspaceId, params.id, dto);
  }
}
