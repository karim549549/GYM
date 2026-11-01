import { FoodLabelDto } from './food-label.dto';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  ValidateIf,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';
import { FoodCategory } from '../enums/food-category.enum';
import { FoodPortionDto } from './food-portion.dto';

export class CreateFoodDto extends FoodLabelDto {
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

  /** Values on entry.basis; stored and returned per 100 g. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(45000)
  caloriesKcalPer100g: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(5000)
  proteinGPer100g: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(5000)
  carbsGPer100g: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(5000)
  fatGPer100g: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(5000)
  fiberGPer100g: number;

  /** The ways it is measured: a cup, a loaf, a piece. */
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => FoodPortionDto)
  portions?: FoodPortionDto[];
}
