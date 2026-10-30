import {
  ArrayUnique,
  IsArray,
  IsBoolean,
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

/** What a coach may change; anything not sent stays as it is. */
export class UpdatePackageDto {
  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  priceMinor?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** null clears it. */
  @IsOptional()
  @IsEnum(CheckinFrequency)
  checkInFrequency?: CheckinFrequency | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(PackageInclude, { each: true })
  includes?: PackageInclude[];

  /** null clears it. */
  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  description?: string | null;
}
