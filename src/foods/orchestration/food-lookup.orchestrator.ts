import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { FoodsQueryHandler } from '../handlers/foods-query.handler';
import type { FoodRecord } from '../interfaces/food.interface';

/**
 * Takes over `FoodsService.findVisible` and `findLibraryBySlugs`, for the modules that hold foods
 * (nutrition plans). The first asks for a workspace's scope; the second is the library only, the
 * same for everyone, so it asks for none and works inside the transaction that creates a workspace.
 */
@Injectable()
export class FoodLookupOrchestrator {
  constructor(
    private readonly foodsQuery: FoodsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  visible(workspaceId: string, foodIds: string[]): Promise<FoodRecord[]> {
    return this.transactions.run(() => this.foodsQuery.findMany(foodIds), {
      workspaceId,
    });
  }

  library(slugs: string[]): Promise<FoodRecord[]> {
    return this.transactions.run(() =>
      this.foodsQuery.findLibraryBySlugs(slugs),
    );
  }
}
