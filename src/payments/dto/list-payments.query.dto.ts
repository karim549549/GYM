import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { CalendarDate } from '../../common/decorators/calendar-date.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaymentMethod } from '../enums/payment-method.enum';

export class ListPaymentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  subscriptionId?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  /** First day to include, YYYY-MM-DD. */
  @IsOptional()
  @CalendarDate()
  from?: string;

  /** Last day to include, YYYY-MM-DD. */
  @IsOptional()
  @CalendarDate()
  to?: string;
}
