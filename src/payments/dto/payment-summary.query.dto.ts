import { CalendarDate } from '../../common/decorators/calendar-date.decorator';

export class PaymentSummaryQueryDto {
  /** First day to include, YYYY-MM-DD. */
  @CalendarDate()
  from: string;

  /** Last day to include, YYYY-MM-DD. */
  @CalendarDate()
  to: string;
}
