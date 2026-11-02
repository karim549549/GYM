import { Injectable } from '@nestjs/common';
import { RecipeReadOrchestrator } from './orchestration/recipe-read.orchestrator';
import { RecipeListOrchestrator } from './orchestration/recipe-list.orchestrator';
import { RecipeLookupOrchestrator } from './orchestration/recipe-lookup.orchestrator';
import { RecipeSaveOrchestrator } from './orchestration/recipe-save.orchestrator';
import { ListRecipesQueryDto } from './dto/list-recipes.query.dto';
import type { NewRecipe, RecipeChanges } from './interfaces/recipe.interface';
@Injectable()
export class RecipesService {
  constructor(
    private readonly read: RecipeReadOrchestrator,
    private readonly listing: RecipeListOrchestrator,
    private readonly lookup: RecipeLookupOrchestrator,
    private readonly save: RecipeSaveOrchestrator,
  ) {}
  list(workspaceId: string, query: ListRecipesQueryDto) {
    return this.listing.execute(workspaceId, query);
  }
  findOne(workspaceId: string, id: string) {
    return this.read.execute(workspaceId, id);
  }
  findVisibleByIds(workspaceId: string, ids: string[]) {
    return this.lookup.execute(workspaceId, ids);
  }
  create(workspaceId: string, input: NewRecipe) {
    return this.save.execute(workspaceId, input);
  }
  update(workspaceId: string, id: string, input: RecipeChanges) {
    return this.save.execute(workspaceId, input, id);
  }
  copy(workspaceId: string, id: string, input: { nameAr?: string }) {
    return this.save.execute(workspaceId, input, id, true);
  }
}
