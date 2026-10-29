import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';

export class PlanSetDto {
  /** Text: 8-10, AMRAP, 12 each side. */
  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  reps?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000)
  weightKg?: number;

  /** Percent of the best single rep, as an alternative to an absolute weight. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(200)
  weightPct?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  restSeconds?: number;

  /** Reps in reserve. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(10)
  rir?: number;
}

export class PlanExerciseDto {
  @IsUUID()
  exerciseId: string;

  /** A note for this client on this exercise. */
  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  coachNote?: string;

  /** The same letter on neighbouring exercises makes them a superset. */
  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2)
  supersetGroup?: string;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PlanSetDto)
  sets: PlanSetDto[];
}

export class PlanDayDto {
  @IsInt()
  @Min(1)
  @Max(52)
  weekNo: number;

  /** 1 to 7. */
  @IsInt()
  @Min(1)
  @Max(7)
  dayNo: number;

  /** For example "chest and triceps". */
  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isRest?: boolean;

  @IsOptional()
  @IsBoolean()
  isDeload?: boolean;

  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => PlanExerciseDto)
  exercises: PlanExerciseDto[];
}
