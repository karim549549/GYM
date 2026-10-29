import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';
import { Difficulty } from '../enums/difficulty.enum';
import { Equipment } from '../enums/equipment.enum';
import { ExercisePattern } from '../enums/exercise-pattern.enum';
import { MuscleId } from '../enums/muscle-id.enum';

/** The hosts a video may be on: it is embedded in the page, so it is never an arbitrary site. */
export const VIDEO_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
];

export class CreateExerciseDto {
  /** What the client sees. */
  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nameAr: string;

  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nameEn: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(Equipment, { each: true })
  equipment?: Equipment[];

  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @IsOptional()
  @IsEnum(ExercisePattern)
  pattern?: ExercisePattern;

  /** Short execution cues; the product asks for three. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(200, { each: true })
  cues?: string[];

  /** Common mistakes; the product asks for two. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(200, { each: true })
  mistakes?: string[];

  /** A YouTube link. */
  @IsOptional()
  @IsUrl({
    protocols: ['https'],
    require_protocol: true,
    host_whitelist: VIDEO_HOSTS,
  })
  @MaxLength(500)
  videoUrl?: string;

  @IsEnum(MuscleId)
  primaryMuscle: MuscleId;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(MuscleId, { each: true })
  secondaryMuscles?: MuscleId[];
}
