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

export class UpdatePlanDto {
  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  /** `null` clears it. */
  @Trimmed()
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  goal?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(52)
  weeks?: number;

  /** `null` clears it. */
  @Trimmed()
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  notes?: string | null;
}
