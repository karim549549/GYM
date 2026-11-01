import { IsUUID } from 'class-validator';

export class PaymentParamsDto {
  @IsUUID()
  id: string;
}
