import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
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

  /** The hour in Egypt the link goes out, 0 to 23. Defaults to 8. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  sendHour?: number;
}
