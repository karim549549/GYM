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

export class FoodUnitDto {
  /** For example "cup" or "loaf", in Arabic. */
  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  labelAr: string;

  /** What one of them weighs, in grams. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(5000)
  grams: number;

  /** The unit offered first. Left out everywhere, the first listed is. */
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
