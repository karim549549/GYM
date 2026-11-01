import { Injectable } from '@nestjs/common';
import type { FoodPortionInput } from '../interfaces/food.interface';

export type FoodPortionsCheck =
  | {
      outcome: 'valid';
      portions: { nameAr: string; weightG: number; isDefault: boolean }[];
    }
  | { outcome: 'invalid'; problems: string[] };

/**
 * The portions a food is measured in. One of them is the default, the one offered first: the coach's
 * choice, or the first listed when they made none. The same name twice is a slip.
 */
@Injectable()
export class FoodPortionsPolicy {
  normalise(portions: FoodPortionInput[]): FoodPortionsCheck {
    const problems: string[] = [];

    if (portions.filter((portion) => portion.isDefault).length > 1) {
      problems.push('portions: more than one default');
    }
    const seen = new Set<string>();
    portions.forEach((portion, index) => {
      const label = portion.nameAr.trim();
      if (seen.has(label)) {
        problems.push(`portions[${index}]: duplicate`);
      }
      seen.add(label);
    });
    if (problems.length > 0) {
      return { outcome: 'invalid', problems };
    }

    const chosen = portions.findIndex((portion) => portion.isDefault);
    const defaultAt = chosen === -1 ? 0 : chosen;
    return {
      outcome: 'valid',
      portions: portions.map((portion, index) => ({
        nameAr: portion.nameAr.trim(),
        weightG: portion.weightG,
        isDefault: index === defaultAt,
      })),
    };
  }
}
