import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { MealDto } from './meal-structure.dto';

export class ReplaceMealsDto {
  /** The whole plan: whatever is not listed is removed. At most 70 meals. */
  @IsArray()
  @ArrayMaxSize(70)
  @ValidateNested({ each: true })
  @Type(() => MealDto)
  meals: MealDto[];
}
