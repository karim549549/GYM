import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import {
  FoodNotEditableException,
  FoodNotFoundException,
} from '../exceptions/food-exceptions';
import { FoodsQueryHandler } from '../handlers/foods-query.handler';
import type { FoodRecord, FoodChanges } from '../interfaces/food.interface';
import { FoodWritePreparationOrchestrator } from './food-write-preparation.orchestrator';

@Injectable()
export class FoodUpdateOrchestrator {
  constructor(
    private readonly foodsQuery: FoodsQueryHandler,
    private readonly preparation: FoodWritePreparationOrchestrator,
    private readonly transactions: TransactionManager,
  ) {}
  execute(
    workspaceId: string,
    foodId: string,
    input: FoodChanges,
  ): Promise<FoodRecord> {
    return this.transactions.run(
      async () => {
        const found = await this.foodsQuery.findById(foodId);
        if (!found) throw new FoodNotFoundException();
        if (!found.isOwn) throw new FoodNotEditableException();
        const { changes, portions } = await this.preparation.execute(
          input,
          found,
        );
        await this.foodsQuery.update(foodId, changes);
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
