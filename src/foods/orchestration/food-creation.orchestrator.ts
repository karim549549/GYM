import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { InvalidFoodException } from '../exceptions/food-exceptions';
import { FoodsQueryHandler } from '../handlers/foods-query.handler';
import type { FoodRecord, NewFood } from '../interfaces/food.interface';
import { FoodMacrosPolicy } from '../policies/food-macros.policy';
import { FoodUnitsPolicy } from '../policies/food-units.policy';

/**
 * Takes over `FoodsService.create`: the coach adds a food of their own, which only they see. Its
 * numbers must agree with each other and its units are normalised (one default) before it is saved.
 */
@Injectable()
export class FoodCreationOrchestrator {
  constructor(
    private readonly foodsQuery: FoodsQueryHandler,
    private readonly macrosPolicy: FoodMacrosPolicy,
    private readonly unitsPolicy: FoodUnitsPolicy,
    private readonly transactions: TransactionManager,
  ) {}

  execute(workspaceId: string, food: NewFood): Promise<FoodRecord> {
    const macros = this.macrosPolicy.check(food);
    const units = this.unitsPolicy.normalise(food.units ?? []);
    const problems = [
      ...(macros.outcome === 'invalid' ? macros.problems : []),
      ...(units.outcome === 'invalid' ? units.problems : []),
    ];
    if (units.outcome === 'invalid' || problems.length > 0) {
      throw new InvalidFoodException(problems);
    }

    return this.transactions.run(
      async () => {
        const id = await this.foodsQuery.create(workspaceId, food);
        await this.foodsQuery.replaceUnits(workspaceId, id, units.units);
        return (await this.foodsQuery.findById(id)) as FoodRecord;
      },
      { workspaceId },
    );
  }
}
