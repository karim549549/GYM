import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { IntakeStatus } from '../enums/intake-status.enum';

export class ListClientsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(IntakeStatus)
  status?: IntakeStatus;

  /** Part of a name or of a phone number. */
  @Trimmed()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;
}
