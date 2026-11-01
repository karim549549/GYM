import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';
import { FoodEntryBasis } from '../enums/food-entry-basis.enum';
import { FoodOrigin } from '../enums/food-origin.enum';
import { FoodState } from '../enums/food-state.enum';
import { NutritionAliasKind } from '../enums/nutrition-alias-kind.enum';

export class FoodEntryDto {
  @IsEnum(FoodEntryBasis)
  basis: FoodEntryBasis;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(5000)
  servingWeightG?: number;
}

export class FoodNutrientDto {
  @IsIn([
    'sugars',
    'saturated_fat',
    'sodium',
    'calcium',
    'iron',
    'potassium',
    'vitamin_c',
  ])
  code: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;
}

export class FoodAliasDto {
  @IsEnum(NutritionAliasKind)
  kind: NutritionAliasKind;

  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  alias: string;
}

export class FoodLabelDto {
  @Trimmed()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  barcode?: string | null;

  @IsOptional()
  @IsEnum(FoodState)
  state?: FoodState | null;

  @Trimmed()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsIn([FoodOrigin.PACKAGE_LABEL, FoodOrigin.ESTIMATE])
  origin?: FoodOrigin.PACKAGE_LABEL | FoodOrigin.ESTIMATE;

  @ValidateIf((_, value) => value !== undefined)
  @ValidateNested()
  @Type(() => FoodEntryDto)
  entry?: FoodEntryDto;

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(7)
  @ArrayUnique((value: FoodNutrientDto | null | undefined) => value?.code)
  @ValidateNested({ each: true })
  @Type(() => FoodNutrientDto)
  nutrients?: FoodNutrientDto[];

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => FoodAliasDto)
  aliases?: FoodAliasDto[];

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  confirmNotDuplicate?: boolean;
}
