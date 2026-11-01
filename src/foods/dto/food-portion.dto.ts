import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';

export class FoodPortionDto {
  /** For example "cup" or "loaf", in Arabic. */
  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  nameAr: string;

  /** What one of them weighs, in grams. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(5000)
  weightG: number;

  /** The portion offered first. Left out everywhere, the first listed is. */
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
