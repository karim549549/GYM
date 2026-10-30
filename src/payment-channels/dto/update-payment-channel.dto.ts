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

/** What a coach may change; anything not sent stays as it is. */
export class UpdatePaymentChannelDto {
  @IsOptional()
  @IsEnum(PaymentChannelMethod)
  method?: PaymentChannelMethod;

  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  account?: string;

  /** null clears it. */
  @Trimmed()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Matches(/^https:\/\/\S+$/, { message: 'url must be an https link' })
  url?: string | null;
}
