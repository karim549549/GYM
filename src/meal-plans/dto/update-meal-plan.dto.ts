import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';

export class UpdateMealPlanDto {
  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  /** `null` clears the target. */
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsInt()
  @Min(0)
  @Max(10_000)
  kcalTarget?: number | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsInt()
  @Min(0)
  @Max(1000)
  proteinTargetG?: number | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsInt()
  @Min(0)
  @Max(2000)
  carbTargetG?: number | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsInt()
  @Min(0)
  @Max(1000)
  fatTargetG?: number | null;

  /** `null` clears it. */
  @Trimmed()
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  notes?: string | null;
}
