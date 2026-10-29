import { IsOptional } from 'class-validator';
import { CalendarDate } from '../../common/decorators/calendar-date.decorator';

export class ResumeSubscriptionDto {
  /** The day the client came back; defaults to today. */
  @IsOptional()
  @CalendarDate()
  resumedOn?: string;
}
