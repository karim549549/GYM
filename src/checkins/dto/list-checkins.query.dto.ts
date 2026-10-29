import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CheckinStatus } from '../enums/checkin-status.enum';

export class ListCheckinsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsEnum(CheckinStatus)
  status?: CheckinStatus;

  /** Query strings are text, so this is 'true' or 'false'. 'true' keeps only what waits for the coach's reply. */
  @IsOptional()
  @IsIn(['true', 'false'])
  needsReply?: 'true' | 'false';
}
