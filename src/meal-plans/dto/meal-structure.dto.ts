import { MealItemChoiceValidator } from '../validators/meal-item-choice.validator';
import { Type } from 'class-transformer';
import {
  Validate,
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsMilitaryTime,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';

export class MealSubstituteDto {
  @ValidateIf(
    (entry: MealSubstituteDto) =>
      entry.foodId !== undefined || entry.recipeId === undefined,
  )
  @IsUUID('all', {
    message: 'Exactly one of foodId or recipeId must be supplied (a UUID)',
  })
  foodId?: string;

  @ValidateIf(
    (entry: MealSubstituteDto) =>
      entry.recipeId !== undefined || entry.foodId === undefined,
  )
  @IsUUID('all', {
    message: 'Exactly one of foodId or recipeId must be supplied (a UUID)',
  })
  recipeId?: string;

  /** In portions when a portion is given, in grams when not. */
  @Validate(MealItemChoiceValidator)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10_000)
  quantity: number;

  @IsOptional()
  @IsUUID()
  portionId?: string;
}

export class MealItemDto extends MealSubstituteDto {
  /** Alternatives the client can swap in when they cannot find the food. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => MealSubstituteDto)
  substitutes?: MealSubstituteDto[];
}

export class MealDto {
  /** Null repeats the meal every day; 1 to 7 pins it to a weekday. */
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(7)
  weekday: number | null;

  /** For example breakfast, lunch, snack. */
  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  /** `HH:MM`, roughly when it is eaten. */
  @IsOptional()
  @IsMilitaryTime()
  suggestedTime?: string;

  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => MealItemDto)
  items: MealItemDto[];
}
