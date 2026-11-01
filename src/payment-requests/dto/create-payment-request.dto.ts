import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';

export class CreatePaymentRequestDto {
  @IsUUID()
  subscriptionId: string;

  /** In piastres: 80000 is EGP 800.00. */
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amountMinor: number;

  /** Shown to the client on the payment page. */
  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  note?: string;
}
