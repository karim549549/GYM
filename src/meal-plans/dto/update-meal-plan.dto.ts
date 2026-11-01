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
  caloriesKcalTarget?: number | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsInt()
  @Min(0)
  @Max(1000)
  proteinGTarget?: number | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsInt()
  @Min(0)
  @Max(2000)
  carbsGTarget?: number | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsInt()
  @Min(0)
  @Max(1000)
  fatGTarget?: number | null;

  /** `null` clears it. */
  @Trimmed()
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  notes?: string | null;
}
