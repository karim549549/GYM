import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateFoodDto } from './create-food.dto';
import { UpdateFoodDto } from './update-food.dto';
import {
  DuplicateFoodPublicationDto,
  RejectFoodPublicationDto,
} from './food-publication.dto';

const label = {
  nameAr: 'منتج',
  category: 'protein',
  caloriesKcalPer100g: 100,
  proteinGPer100g: 20,
  carbsGPer100g: 5,
  fatGPer100g: 0,
  fiberGPer100g: 0,
};

describe('Food label boundary', () => {
  it('accepts old per 100 g entries and large serving values', async () => {
    expect(await validate(plainToInstance(CreateFoodDto, label))).toEqual([]);
    expect(
      await validate(
        plainToInstance(CreateFoodDto, {
          ...label,
          caloriesKcalPer100g: 2000,
          proteinGPer100g: 400,
          entry: { basis: 'per_serving', servingWeightG: 2000 },
        }),
      ),
    ).toEqual([]);
  });
  it.each([
    { origin: 'seed' },
    { origin: 'calculated' },
    { state: 'burnt' },
    { entry: { basis: 'per_cup' } },
    { entry: { basis: 'per_serving', servingWeightG: 0 } },
    { entry: { basis: 'per_serving', servingWeightG: 5001 } },
    { nutrients: [{ code: 'unknown', amount: 1 }] },
    { nutrients: [null] },
    { nutrients: [{ code: 'sodium', amount: -1 }] },
    {
      nutrients: [
        { code: 'sodium', amount: 1 },
        { code: 'sodium', amount: 2 },
      ],
    },
    { aliases: [{ kind: 'wrong', alias: 'x' }] },
    { aliases: [{ kind: 'alias_ar', alias: ' ' }] },
    {
      aliases: Array.from({ length: 11 }, () => ({
        kind: 'alias_ar',
        alias: 'x',
      })),
    },
    { confirmNotDuplicate: 'true' },
  ])('refuses invalid label pieces %j', async (input) => {
    expect(
      (await validate(plainToInstance(CreateFoodDto, { ...label, ...input })))
        .length,
    ).toBeGreaterThan(0);
  });
  it('allows an empty patch and clearing optional text', async () => {
    expect(await validate(plainToInstance(UpdateFoodDto, {}))).toEqual([]);
    expect(
      await validate(
        plainToInstance(UpdateFoodDto, {
          brand: null,
          barcode: null,
          nameEn: null,
        }),
      ),
    ).toEqual([]);
  });
  it('requires a rejection note and duplicate target', async () => {
    expect(
      (await validate(plainToInstance(RejectFoodPublicationDto, { note: ' ' })))
        .length,
    ).toBeGreaterThan(0);
    expect(
      (await validate(plainToInstance(DuplicateFoodPublicationDto, {}))).length,
    ).toBeGreaterThan(0);
  });
});
