import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CalendarDate } from '../../common/decorators/calendar-date.decorator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';
import { PaymentMethod } from '../../payments/enums/payment-method.enum';

export class RecordPaymentDto {
  /** In piastres: 80000 is EGP 800.00. */
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amountMinor: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  /** The day the money was received; defaults to today in Egypt. */
  @IsOptional()
  @CalendarDate()
  paidOn?: string;

  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  note?: string;
}
