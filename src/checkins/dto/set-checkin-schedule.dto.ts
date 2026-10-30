import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsMilitaryTime,
  isNumberString,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { CalendarDate } from '../../common/decorators/calendar-date.decorator';
import { CheckinFrequency } from '../enums/checkin-frequency.enum';

export class SetCheckinScheduleDto {
  /** Defaults to weekly. */
  @IsOptional()
  @IsEnum(CheckinFrequency)
  frequency?: CheckinFrequency;

  /** 0 is Sunday. Used by a weekly or fortnightly check-in, which defaults to Friday. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  /** The time in Egypt the link goes out, HH:MM. Defaults to 08:00. */
  @IsOptional()
  // the validator also allows HHMM; keep the one form the rest of the code reads
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' &&
    value.length === 4 &&
    isNumberString(value, { no_symbols: true })
      ? `${value.slice(0, 2)}:${value.slice(2)}`
      : value,
  )
  @IsMilitaryTime()
  sendAt?: string;

  /** The first day to ask from, YYYY-MM-DD. Defaults to today. */
  @IsOptional()
  @CalendarDate()
  startsOn?: string;
}
