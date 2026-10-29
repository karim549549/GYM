import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';
import { FoodCategory } from '../enums/food-category.enum';
import { FoodUnitDto } from './food-unit.dto';

export class CreateFoodDto {
  /** What the client sees. */
  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nameAr: string;

  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nameEn?: string;

  @IsEnum(FoodCategory)
  category: FoodCategory;

  /** Every macro is per 100 grams, with no exceptions. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(900)
  kcal100g: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  protein100g: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  carb100g: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  fat100g: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  fiber100g: number;

  /** The ways it is measured: a cup, a loaf, a piece. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => FoodUnitDto)
  units?: FoodUnitDto[];
}
