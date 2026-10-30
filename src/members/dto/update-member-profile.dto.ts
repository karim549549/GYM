import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  NotContains,
} from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';
import { ClientCountRange } from '../enums/client-count-range.enum';
import { Specialty } from '../enums/specialty.enum';

/** What a coach may change about their own profile. null clears a field; leaving it out keeps it. */
export class UpdateMemberProfileDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(5)
  @IsEnum(Specialty, { each: true })
  specialties?: Specialty[];

  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  bio?: string | null;

  /** The account name, written without the @ however the coach typed it. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/^@+/, '') : value,
  )
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @NotContains(' ')
  instagram?: string | null;

  /** How many clients the coach has now. null clears it. */
  @IsOptional()
  @IsEnum(ClientCountRange)
  clientCountRange?: ClientCountRange | null;
}
