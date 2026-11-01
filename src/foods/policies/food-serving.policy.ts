import { Injectable } from '@nestjs/common';
import { FoodEntryBasis } from '../enums/food-entry-basis.enum';
import type { FoodEntryInput } from '../interfaces/food.interface';

@Injectable()
export class FoodServingPolicy {
  convert(
    amounts: number[],
    entry?: FoodEntryInput,
  ):
    | { outcome: 'valid'; amounts: number[] }
    | { outcome: 'invalid'; problems: string[] } {
    const weight = entry?.servingWeightG;
    if (
      entry?.basis === FoodEntryBasis.PER_SERVING &&
      (weight === undefined ||
        !Number.isFinite(weight) ||
        weight <= 0 ||
        weight > 5000)
    ) {
      return {
        outcome: 'invalid',
        problems: [
          'entry.servingWeightG: required, greater than 0 and at most 5000',
        ],
      };
    }
    if (amounts.some((amount) => !Number.isFinite(amount) || amount < 0)) {
      return {
        outcome: 'invalid',
        problems: ['amounts: must be finite and nonnegative'],
      };
    }
    const converted = amounts.map((amount) => {
      const per100g =
        entry?.basis === FoodEntryBasis.PER_SERVING
          ? (amount * 100) / (weight as number)
          : amount;
      return Math.round((per100g + Number.EPSILON) * 100) / 100;
    });
    return converted.some((amount) => !Number.isFinite(amount))
      ? {
          outcome: 'invalid',
          problems: ['amounts: conversion is out of range'],
        }
      : { outcome: 'valid', amounts: converted };
  }
}
