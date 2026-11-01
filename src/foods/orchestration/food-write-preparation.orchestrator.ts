import { Injectable } from '@nestjs/common';
import { FoodEntryBasis } from '../enums/food-entry-basis.enum';
import {
  FoodBarcodeExistsException,
  FoodPossibleDuplicateException,
  InvalidBarcodeException,
  InvalidFoodException,
} from '../exceptions/food-exceptions';
import { FoodsQueryHandler } from '../handlers/foods-query.handler';
import type {
  FoodChanges,
  FoodMacros,
  FoodRecord,
} from '../interfaces/food.interface';
import { FoodServingPolicy } from '../policies/food-serving.policy';
import { FoodBarcodePolicy } from '../policies/food-barcode.policy';
import { FoodMacrosPolicy } from '../policies/food-macros.policy';
import { FoodPortionsPolicy } from '../policies/food-portions.policy';

@Injectable()
export class FoodWritePreparationOrchestrator {
  constructor(
    private readonly query: FoodsQueryHandler,
    private readonly serving: FoodServingPolicy,
    private readonly barcode: FoodBarcodePolicy,
    private readonly macros: FoodMacrosPolicy,
    private readonly portions: FoodPortionsPolicy,
  ) {}

  async execute(input: FoodChanges, found?: FoodRecord) {
    const keys: (keyof FoodMacros)[] = [
      'caloriesKcalPer100g',
      'proteinGPer100g',
      'carbsGPer100g',
      'fatGPer100g',
      'fiberGPer100g',
    ];
    const supplied = keys.filter((key) => input[key] !== undefined);
    if (
      input.entry?.basis === FoodEntryBasis.PER_SERVING &&
      supplied.length !== keys.length
    ) {
      throw new InvalidFoodException([
        'entry: per serving requires all five macros',
      ]);
    }
    const converted = this.serving.convert(
      [
        ...supplied.map((key) => input[key] as number),
        ...(input.nutrients ?? []).map((n) => n.amount),
      ],
      input.entry,
    );
    if (converted.outcome === 'invalid')
      throw new InvalidFoodException(converted.problems);
    const changes = { ...input };
    supplied.forEach((key, index) => {
      changes[key] = converted.amounts[index];
    });
    if (input.nutrients)
      changes.nutrients = input.nutrients.map((n, index) => ({
        ...n,
        amount: converted.amounts[supplied.length + index],
      }));
    // only what was sent replaces what is stored: a request object carries every field it did not send as
    // undefined, and spreading it over the stored food would blank the numbers the check needs
    const merged = Object.fromEntries(
      keys.map((key) => [key, changes[key] ?? found?.[key]]),
    ) as unknown as FoodMacros;
    const numbers = this.macros.check(merged);
    if (numbers.outcome === 'invalid')
      throw new InvalidFoodException(numbers.problems);
    if (input.barcode !== undefined && input.barcode !== null) {
      if (this.barcode.check(input.barcode).outcome === 'invalid')
        throw new InvalidBarcodeException();
      const existing = await this.query.findBarcode(input.barcode, found?.id);
      if (existing) throw new FoodBarcodeExistsException(existing);
    }
    if (
      !input.confirmNotDuplicate &&
      (!found ||
        input.nameAr !== undefined ||
        input.nameEn !== undefined ||
        input.brand !== undefined)
    ) {
      const candidates = await this.query.findDuplicates(
        input.nameAr ?? found!.nameAr,
        input.nameEn === undefined ? found?.nameEn : input.nameEn,
        input.brand === undefined ? found?.brand : input.brand,
        found?.id,
      );
      if (candidates.length)
        throw new FoodPossibleDuplicateException(candidates);
    }
    const requestedPortions =
      input.portions ??
      (input.entry?.basis === FoodEntryBasis.PER_SERVING
        ? [
            {
              nameAr: 'حصة',
              weightG: input.entry.servingWeightG as number,
              isDefault: true,
            },
          ]
        : undefined);
    const portions =
      requestedPortions === undefined
        ? undefined
        : this.portions.normalise(requestedPortions);
    if (portions?.outcome === 'invalid')
      throw new InvalidFoodException(portions.problems);
    return { changes, portions: portions?.portions };
  }
}
