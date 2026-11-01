import { Controller, Get, Query } from '@nestjs/common';
import { CurrentWorkspaceId } from '../common/decorators/current-workspace-id.decorator';
import { RequireAction } from '../common/decorators/require-action.decorator';
import { WorkspaceAction } from '../members/enums/workspace-action.enum';
import { ListFoodPublicationsQueryDto } from './dto/food-publication.dto';
import { FoodsService } from './foods.service';

@Controller('food-publication-requests')
export class FoodPublicationController {
  constructor(private readonly foods: FoodsService) {}
  @RequireAction(WorkspaceAction.COACHING_READ)
  @Get()
  list(
    @CurrentWorkspaceId() workspaceId: string,
    @Query() query: ListFoodPublicationsQueryDto,
  ) {
    return this.foods.listPublications(query, workspaceId);
  }
}
