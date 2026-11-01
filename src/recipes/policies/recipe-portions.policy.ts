import { Injectable } from '@nestjs/common';
import type { RecipePortionInput } from '../interfaces/recipe.interface';
@Injectable()
export class RecipePortionsPolicy {
  check(
    portions: RecipePortionInput[],
  ): { outcome: 'valid' } | { outcome: 'invalid'; problems: string[] } {
    return portions.filter((p) => p.isDefault).length === 1
      ? { outcome: 'valid' }
      : {
          outcome: 'invalid',
          problems: ['portions: exactly one default required'],
        };
  }
}
