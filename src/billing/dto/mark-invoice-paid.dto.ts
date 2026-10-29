import { IsEnum, IsOptional } from 'class-validator';
import { CalendarDate } from '../../common/decorators/calendar-date.decorator';
import { InvoicePaymentMethod } from '../enums/invoice-payment-method.enum';

export class MarkInvoicePaidDto {
  @IsEnum(InvoicePaymentMethod)
  method: InvoicePaymentMethod;

  /** The day the money arrived; defaults to today in Egypt. */
  @IsOptional()
  @CalendarDate()
  paidOn?: string;
}
