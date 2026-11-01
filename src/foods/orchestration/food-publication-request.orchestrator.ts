import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import {
  FoodNotEditableException,
  FoodNotFoundException,
  FoodPublicationAlreadyRequestedException,
  InvalidFoodException,
} from '../exceptions/food-exceptions';
import { FoodsQueryHandler } from '../handlers/foods-query.handler';
import { FoodPublicationQueryHandler } from '../handlers/food-publication-query.handler';

@Injectable()
export class FoodPublicationRequestOrchestrator {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly foods: FoodsQueryHandler,
    private readonly requests: FoodPublicationQueryHandler,
  ) {}

  execute(workspaceId: string, foodId: string) {
    return this.transactions.run(
      async () => {
        const food = await this.foods.findById(foodId);
        if (!food) throw new FoodNotFoundException();
        if (!food.isOwn) throw new FoodNotEditableException();
        if (!food.isActive)
          throw new InvalidFoodException(['food: must be active']);
        const request = await this.requests.request(workspaceId, foodId);
        if (!request) throw new FoodPublicationAlreadyRequestedException();
        return { ...request, food };
      },
      { workspaceId },
    );
  }
}
