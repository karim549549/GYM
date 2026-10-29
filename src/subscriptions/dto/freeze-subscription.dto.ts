import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { CalendarDate } from '../../common/decorators/calendar-date.decorator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';

export class FreezeSubscriptionDto {
  /** The day the pause began; defaults to today, and can be earlier when the coach remembers late. */
  @IsOptional()
  @CalendarDate()
  frozenOn?: string;

  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason?: string;
}
