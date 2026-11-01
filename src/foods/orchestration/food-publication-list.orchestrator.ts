import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../../common/handlers/base-query.handler';
import { TransactionManager } from '../../database/transaction.manager';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import type { ListFoodPublicationsQueryDto } from '../dto/food-publication.dto';
import { FoodsQueryHandler } from '../handlers/foods-query.handler';
import { FoodPublicationQueryHandler } from '../handlers/food-publication-query.handler';
import type { FoodPublicationDetails } from '../interfaces/food-publication.interface';

@Injectable()
export class FoodPublicationListOrchestrator {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly foods: FoodsQueryHandler,
    private readonly requests: FoodPublicationQueryHandler,
    private readonly workspaces: WorkspacesService,
  ) {}

  async execute(
    query: ListFoodPublicationsQueryDto,
    workspaceId?: string,
  ): Promise<PaginatedResponse<FoodPublicationDetails>> {
    const result = await this.transactions.run(
      async () => {
        const page = await this.requests.list(
          query.status,
          query.page,
          query.limit,
        );
        const foods = await this.foods.findMany(
          page.items.map((request) => request.foodId),
        );
        return {
          ...page,
          items: page.items.map((request) => ({
            ...request,
            food: foods.find((food) => food.id === request.foodId)!,
          })),
        };
      },
      workspaceId ? { workspaceId } : { system: true },
    );
    if (workspaceId) return result;
    const entries = await Promise.all(
      Array.from(
        new Set(result.items.map((request) => request.workspaceId)),
        async (id) =>
          [id, (await this.workspaces.findCurrent(id)).brandName] as const,
      ),
    );
    const brands = new Map(entries);
    return {
      ...result,
      items: result.items.map((request) => ({
        ...request,
        coachBrandName: brands.get(request.workspaceId),
      })),
    };
  }
}
