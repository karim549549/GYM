import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Difficulty } from '../enums/difficulty.enum';
import { Equipment } from '../enums/equipment.enum';
import { ExercisePattern } from '../enums/exercise-pattern.enum';
import { MuscleId } from '../enums/muscle-id.enum';

export class ListExercisesQueryDto extends PaginationQueryDto {
  /** Part of the Arabic or the English name. */
  @Trimmed()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  /** Comma separated: exercises that need any of these. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',') : value,
  )
  @IsArray()
  @IsEnum(Equipment, { each: true })
  equipment?: Equipment[];

  @IsOptional()
  @IsEnum(MuscleId)
  muscle?: MuscleId;

  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @IsOptional()
  @IsEnum(ExercisePattern)
  pattern?: ExercisePattern;

  /** Query strings are text, so this is 'true' or 'false'. */
  @IsOptional()
  @IsIn(['true', 'false'])
  includeInactive?: 'true' | 'false';
}
