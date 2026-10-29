import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';

export class CreatePlanDto {
  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  goal?: string;

  /** 1 to 52. Defaults to the copied plan's length, or 4. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(52)
  weeks?: number;

  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  notes?: string;

  /** The client the plan is for. Left out, it is a template. */
  @IsOptional()
  @IsUUID()
  clientId?: string;

  /** Start from a copy of this plan or template, the usual way to begin. */
  @IsOptional()
  @IsUUID()
  fromPlanId?: string;
}
