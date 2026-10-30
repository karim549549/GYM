import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CheckinFrequency } from '../../checkins/enums/checkin-frequency.enum';
import { Trimmed } from '../../common/decorators/trimmed.decorator';
import { PackageInclude } from '../enums/package-include.enum';

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

  /** How often the coach checks in with the client on this package. */
  @IsOptional()
  @IsEnum(CheckinFrequency)
  checkInFrequency?: CheckinFrequency;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(PackageInclude, { each: true })
  includes?: PackageInclude[];

  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  description?: string;
}
