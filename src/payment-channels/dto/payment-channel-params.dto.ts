import { IsUUID } from 'class-validator';

export class PaymentChannelParamsDto {
  @IsUUID()
  id: string;
}
