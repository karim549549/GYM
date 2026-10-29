import {
  IsEnum,
  IsInt,
  IsISO4217CurrencyCode,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUppercase,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';
import { UnitSystem } from '../enums/unit-system.enum';

/** The settings a coach can change; anything not sent stays as it is. */
export class UpdateWorkspaceDto {
  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  brandName?: string;

  @IsOptional()
  @IsString()
  @IsUppercase()
  @IsISO4217CurrencyCode()
  currency?: string;

  @IsOptional()
  @IsEnum(UnitSystem)
  unitSystem?: UnitSystem;

  /** How many days before a subscription ends the coach is alerted. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  expiryAlertDays?: number;
}
