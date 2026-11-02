import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { FoodPublicationStatus } from '../enums/food-publication-status.enum';
import { NutritionConfidence } from '../enums/nutrition-confidence.enum';
import {
  FoodBarcodeExistsException,
  FoodPublicationChangedException,
  FoodPublicationNotFoundException,
  FoodPublicationNotPendingException,
  InvalidFoodException,
} from '../exceptions/food-exceptions';
import { FoodsQueryHandler } from '../handlers/foods-query.handler';
import { FoodPublicationQueryHandler } from '../handlers/food-publication-query.handler';

@Injectable()
export class FoodPublicationReviewOrchestrator {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly foods: FoodsQueryHandler,
    private readonly requests: FoodPublicationQueryHandler,
  ) {}

  execute(
    id: string,
    personId: string,
    status:
      | FoodPublicationStatus.APPROVED
      | FoodPublicationStatus.REJECTED
      | FoodPublicationStatus.DUPLICATE,
    note?: string,
    duplicateOfFoodId?: string,
  ) {
    return this.transactions.run(
      async () => {
        const request = await this.requests.find(id);
        if (!request) throw new FoodPublicationNotFoundException();
        if (request.status !== FoodPublicationStatus.PENDING)
          throw new FoodPublicationNotPendingException();
        if (status === FoodPublicationStatus.DUPLICATE) {
          const duplicate = duplicateOfFoodId
            ? await this.foods.findById(duplicateOfFoodId)
            : null;
          if (!duplicate || duplicate.isCustom)
            throw new InvalidFoodException([
              'duplicateOfFoodId: must be a shared food',
            ]);
        }
        if (
          status === FoodPublicationStatus.APPROVED &&
          (await this.requests.currentFingerprint(request.foodId)) !==
            request.contentFingerprint
        )
          throw new FoodPublicationChangedException();
        const decided = await this.requests.decide(
          id,
          status,
          personId,
          note,
          duplicateOfFoodId,
        );
        if (!decided) throw new FoodPublicationNotPendingException();
        let sharedFoodId: string | undefined;
        if (status === FoodPublicationStatus.APPROVED) {
          const food = (await this.foods.findById(request.foodId))!;
          if (food.barcode) {
            const existing = await this.foods.findBarcode(
              food.barcode,
              food.id,
              true,
            );
            if (existing && !existing.isCustom)
              throw new FoodBarcodeExistsException(existing);
          }
          const originNote = [
            food.originNote,
            `Suggested by a coach, approved on ${new Date().toISOString().slice(0, 10)}`,
          ]
            .filter(Boolean)
            .join('\n');
          const copiedId = await this.requests.copyShared(food.id, {
            originNote,
            confidence: NutritionConfidence.LOW,
            isVerified: false,
          });
          if (!copiedId) {
            throw new FoodBarcodeExistsException(
              await this.foods.findBarcode(food.barcode!, food.id, true),
            );
          }
          sharedFoodId = copiedId;
        }
        return { ...decided, sharedFoodId };
      },
      { system: true },
    );
  }
}
