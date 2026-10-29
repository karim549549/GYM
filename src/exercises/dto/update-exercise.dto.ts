import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';
import { Difficulty } from '../enums/difficulty.enum';
import { Equipment } from '../enums/equipment.enum';
import { ExercisePattern } from '../enums/exercise-pattern.enum';
import { MuscleId } from '../enums/muscle-id.enum';
import { VIDEO_HOSTS } from './create-exercise.dto';

export class UpdateExerciseDto {
  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nameAr?: string;

  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nameEn?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(Equipment, { each: true })
  equipment?: Equipment[];

  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  /** `null` clears it. */
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsEnum(ExercisePattern)
  pattern?: ExercisePattern | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(200, { each: true })
  cues?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(200, { each: true })
  mistakes?: string[];

  /** A YouTube link; `null` clears it. */
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUrl({
    protocols: ['https'],
    require_protocol: true,
    host_whitelist: VIDEO_HOSTS,
  })
  @MaxLength(500)
  videoUrl?: string | null;

  /** False takes it out of the list; plans that hold it keep showing it. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(MuscleId)
  primaryMuscle?: MuscleId;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(MuscleId, { each: true })
  secondaryMuscles?: MuscleId[];
}
