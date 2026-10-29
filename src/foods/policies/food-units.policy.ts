import { Injectable } from '@nestjs/common';
import type { FoodUnitInput } from '../interfaces/food.interface';

export type FoodUnitsCheck =
  | {
      outcome: 'valid';
      units: { labelAr: string; grams: number; isDefault: boolean }[];
    }
  | { outcome: 'invalid'; problems: string[] };

/**
 * The units a food is measured in. One of them is the default, the one offered first: the coach's
 * choice, or the first listed when they made none. The same name twice is a slip.
 */
@Injectable()
export class FoodUnitsPolicy {
  normalise(units: FoodUnitInput[]): FoodUnitsCheck {
    const problems: string[] = [];

    if (units.filter((unit) => unit.isDefault).length > 1) {
      problems.push('units: more than one default');
    }
    const seen = new Set<string>();
    units.forEach((unit, index) => {
      const label = unit.labelAr.trim();
      if (seen.has(label)) {
        problems.push(`units[${index}]: duplicate`);
      }
      seen.add(label);
    });
    if (problems.length > 0) {
      return { outcome: 'invalid', problems };
    }

    const chosen = units.findIndex((unit) => unit.isDefault);
    const defaultAt = chosen === -1 ? 0 : chosen;
    return {
      outcome: 'valid',
      units: units.map((unit, index) => ({
        labelAr: unit.labelAr.trim(),
        grams: unit.grams,
        isDefault: index === defaultAt,
      })),
    };
  }
}
