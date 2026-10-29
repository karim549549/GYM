import { IsOptional } from 'class-validator';
import { CalendarDate } from '../../common/decorators/calendar-date.decorator';

export class ActivatePlanDto {
  /** The day the client starts; defaults to today in Egypt. */
  @IsOptional()
  @CalendarDate()
  startsOn?: string;
}
