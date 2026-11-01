import { FoodLabelDto } from './food-label.dto';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
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

export class UpdateFoodDto extends FoodLabelDto {
  @Trimmed()
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nameAr?: string;

  /** `null` clears it. */
  @Trimmed()
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nameEn?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(FoodCategory)
  category?: FoodCategory;

  @ValidateIf((_, value) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(45000)
  caloriesKcalPer100g?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(5000)
  proteinGPer100g?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(5000)
  carbsGPer100g?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(5000)
  fatGPer100g?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(5000)
  fiberGPer100g?: number;

  /** False takes it out of the list; plans that hold it keep showing it. */
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;

  /** The whole list of portions: it replaces the old one. */
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => FoodPortionDto)
  portions?: FoodPortionDto[];
}
