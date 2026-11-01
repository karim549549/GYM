import { IsUUID } from 'class-validator';

export class PaymentRequestParamsDto {
  @IsUUID()
  id: string;
}
