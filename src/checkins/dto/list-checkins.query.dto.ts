import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { CalendarDate } from '../../common/decorators/calendar-date.decorator';
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

  /** Only check-ins due on or after this day, YYYY-MM-DD. */
  @IsOptional()
  @CalendarDate()
  dueFrom?: string;

  /** Only check-ins due on or before this day, YYYY-MM-DD. */
  @IsOptional()
  @CalendarDate()
  dueTo?: string;
}
