import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import {
  FoodNotEditableException,
  FoodNotFoundException,
  InvalidFoodException,
} from '../exceptions/food-exceptions';
import { FoodsQueryHandler } from '../handlers/foods-query.handler';
import type { FoodChanges, FoodRecord } from '../interfaces/food.interface';
import { FoodMacrosPolicy } from '../policies/food-macros.policy';
import { FoodUnitsPolicy } from '../policies/food-units.policy';

/**
 * Takes over `FoodsService.update`: change what was sent and leave the rest. Only the coach's own
 * foods change; the library's are the same for everyone. The numbers are checked as they will be
 * after the change, so one edited alone cannot break the others. Plans already built keep the
 * numbers they were built with.
 */
@Injectable()
export class FoodUpdateOrchestrator {
  constructor(
    private readonly foodsQuery: FoodsQueryHandler,
    private readonly macrosPolicy: FoodMacrosPolicy,
    private readonly unitsPolicy: FoodUnitsPolicy,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    workspaceId: string,
    foodId: string,
    changes: FoodChanges,
  ): Promise<FoodRecord> {
    return this.transactions.run(
      async () => {
        const found = await this.foodsQuery.findById(foodId);
        if (!found) {
          throw new FoodNotFoundException();
        }
        if (!found.isCustom) {
          throw new FoodNotEditableException();
        }

        const macros = this.macrosPolicy.check({
          kcal100g: changes.kcal100g ?? found.kcal100g,
          protein100g: changes.protein100g ?? found.protein100g,
          carb100g: changes.carb100g ?? found.carb100g,
          fat100g: changes.fat100g ?? found.fat100g,
          fiber100g: changes.fiber100g ?? found.fiber100g,
        });
        const units = changes.units
          ? this.unitsPolicy.normalise(changes.units)
          : null;
        const problems = [
          ...(macros.outcome === 'invalid' ? macros.problems : []),
          ...(units?.outcome === 'invalid' ? units.problems : []),
        ];
        if (problems.length > 0) {
          throw new InvalidFoodException(problems);
        }

        await this.foodsQuery.update(foodId, changes);
        if (units?.outcome === 'valid') {
          await this.foodsQuery.replaceUnits(workspaceId, foodId, units.units);
        }
        return (await this.foodsQuery.findById(foodId)) as FoodRecord;
      },
      { workspaceId },
    );
  }
}
