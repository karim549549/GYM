import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';
import { FoodCategory } from '../enums/food-category.enum';
import { FoodUnitDto } from './food-unit.dto';

export class UpdateFoodDto {
  @Trimmed()
  @IsOptional()
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

  @IsOptional()
  @IsEnum(FoodCategory)
  category?: FoodCategory;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(900)
  kcal100g?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  protein100g?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  carb100g?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  fat100g?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  fiber100g?: number;

  /** False takes it out of the list; plans that hold it keep showing it. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** The whole list of units: it replaces the old one. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => FoodUnitDto)
  units?: FoodUnitDto[];
}
