import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { FoodNotFoundException } from '../exceptions/food-exceptions';
import { FoodsQueryHandler } from '../handlers/foods-query.handler';
import type { FoodRecord } from '../interfaces/food.interface';

/** Takes over `FoodsService.findOne`: a library food or one of the coach's own, active or not. */
@Injectable()
export class FoodDetailsOrchestrator {
  constructor(
    private readonly foodsQuery: FoodsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(workspaceId: string, foodId: string): Promise<FoodRecord> {
    const found = await this.transactions.run(
      () => this.foodsQuery.findById(foodId),
      { workspaceId },
    );
    if (!found) {
      throw new FoodNotFoundException();
    }
    return found;
  }
}
