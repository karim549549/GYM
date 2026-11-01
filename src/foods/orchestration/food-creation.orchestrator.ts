import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { FoodsQueryHandler } from '../handlers/foods-query.handler';
import type { FoodRecord, NewFood } from '../interfaces/food.interface';
import { FoodWritePreparationOrchestrator } from './food-write-preparation.orchestrator';

@Injectable()
export class FoodCreationOrchestrator {
  constructor(
    private readonly foodsQuery: FoodsQueryHandler,
    private readonly preparation: FoodWritePreparationOrchestrator,
    private readonly transactions: TransactionManager,
  ) {}
  execute(workspaceId: string, food: NewFood): Promise<FoodRecord> {
    return this.transactions.run(
      async () => {
        const { changes, portions } = await this.preparation.execute(food);
        const foodId = await this.foodsQuery.create(
          workspaceId,
          changes as NewFood,
        );
        if (portions)
          await this.foodsQuery.replacePortions(workspaceId, foodId, portions);
        if (changes.aliases)
          await this.foodsQuery.replaceAliases(
            workspaceId,
            foodId,
            changes.aliases,
          );
        if (changes.nutrients)
          await this.foodsQuery.replaceNutrients(
            workspaceId,
            foodId,
            changes.nutrients,
          );
        return (await this.foodsQuery.findById(foodId)) as FoodRecord;
      },
      { workspaceId },
    );
  }
}
