import { CalendarDate } from '../../common/decorators/calendar-date.decorator';

export class UpdateSubscriptionDto {
  @CalendarDate()
  endsOn: string;
}
