import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RequireAction } from '../common/decorators/require-action.decorator';
import { CurrentWorkspaceId } from '../common/decorators/current-workspace-id.decorator';
import { WorkspaceAction } from '../members/enums/workspace-action.enum';
import { RecipesService } from './recipes.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { CopyRecipeDto } from './dto/copy-recipe.dto';
import { RecipeParamsDto } from './dto/recipe-params.dto';
import { ListRecipesQueryDto } from './dto/list-recipes.query.dto';
@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipes: RecipesService) {}
  @Get()
  @RequireAction(WorkspaceAction.COACHING_READ)
  list(
    @CurrentWorkspaceId() workspaceId: string,
    @Query() query: ListRecipesQueryDto,
  ) {
    return this.recipes.list(workspaceId, query);
  }
  @Get(':id')
  @RequireAction(WorkspaceAction.COACHING_READ)
  findOne(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: RecipeParamsDto,
  ) {
    return this.recipes.findOne(workspaceId, params.id);
  }
  @Post()
  @RequireAction(WorkspaceAction.COACHING_WRITE)
  create(
    @CurrentWorkspaceId() workspaceId: string,
    @Body() dto: CreateRecipeDto,
  ) {
    return this.recipes.create(workspaceId, dto);
  }
  @Patch(':id')
  @RequireAction(WorkspaceAction.COACHING_WRITE)
  update(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: RecipeParamsDto,
    @Body() dto: UpdateRecipeDto,
  ) {
    return this.recipes.update(workspaceId, params.id, dto);
  }
  @Post(':id/copy')
  @RequireAction(WorkspaceAction.COACHING_WRITE)
  copy(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: RecipeParamsDto,
    @Body() dto: CopyRecipeDto,
  ) {
    return this.recipes.copy(workspaceId, params.id, dto);
  }
}
