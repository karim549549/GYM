import { Type } from 'class-transformer';
import {
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
} from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';

export class MealSubstituteDto {
  @IsUUID()
  foodId: string;

  /** In units when a unit is given, in grams when not. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10_000)
  quantity: number;

  @IsOptional()
  @IsUUID()
  unitId?: string;
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
  /** 0 repeats the meal every day; 1 to 7 pins it to a weekday. */
  @IsInt()
  @Min(0)
  @Max(7)
  dayNo: number;

  /** For example breakfast, lunch, snack. */
  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  /** `HH:MM`, roughly when it is eaten. */
  @IsOptional()
  @IsMilitaryTime()
  timeHint?: string;

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
