import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../../common/handlers/base-query.handler';
import { TransactionManager } from '../../database/transaction.manager';
import { FoodsQueryHandler } from '../handlers/foods-query.handler';
import type { FoodListFilter, FoodRecord } from '../interfaces/food.interface';

/** Takes over `FoodsService.list`: the library and the coach's own foods, by Arabic name. */
@Injectable()
export class FoodListOrchestrator {
  constructor(
    private readonly foodsQuery: FoodsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    workspaceId: string,
    filter: FoodListFilter,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<FoodRecord>> {
    return this.transactions.run(
      () => this.foodsQuery.list(filter, page, limit),
      { workspaceId },
    );
  }
}
