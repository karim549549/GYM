import { IsAlphanumeric, Length } from 'class-validator';

/** The secret in a payment link's address: 12 letters and digits. Anything else cannot be a token. */
export class PaymentTokenParamsDto {
  @IsAlphanumeric()
  @Length(12, 12)
  token: string;
}
