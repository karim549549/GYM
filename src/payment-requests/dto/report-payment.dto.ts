import { IsEnum } from 'class-validator';
import { PaymentMethod } from '../../payments/enums/payment-method.enum';

export class ReportPaymentDto {
  /** Where the client sent the money from. */
  @IsEnum(PaymentMethod)
  method: PaymentMethod;
}
