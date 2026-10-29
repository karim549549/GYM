import { IsUUID } from 'class-validator';

export class SubscriptionParamsDto {
  @IsUUID()
  id: string;
}
