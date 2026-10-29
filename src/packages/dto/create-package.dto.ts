import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';

export class CreatePackageDto {
  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays: number;

  /** In piastres. Zero is allowed (a free trial); the top is EGP 1,000,000. */
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  priceMinor: number;
}
