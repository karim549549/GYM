import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';
import { PaymentChannelMethod } from '../enums/payment-channel-method.enum';

export class CreatePaymentChannelDto {
  @IsEnum(PaymentChannelMethod)
  method: PaymentChannelMethod;

  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  account: string;

  /** Must be a secure link. */
  @Trimmed()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Matches(/^https:\/\/\S+$/, { message: 'url must be an https link' })
  url?: string;
}
