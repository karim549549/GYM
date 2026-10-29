import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { CalendarDate } from '../../common/decorators/calendar-date.decorator';

export class CreateSubscriptionDto {
  @IsUUID()
  packageId: string;

  /** Defaults to today in Egypt. */
  @IsOptional()
  @CalendarDate()
  startsOn?: string;

  /** In piastres. Only when the price agreed with this client differs from the package's. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  priceMinor?: number;
}
