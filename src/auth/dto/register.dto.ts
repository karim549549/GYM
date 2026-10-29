import {
  Equals,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Phone } from '../../common/decorators/phone.decorator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';

export class RegisterDto {
  @Phone()
  phone: string;

  // bcrypt, which Supabase uses, ignores everything past 72 bytes
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName: string;

  /** The terms of use and the privacy policy, accepted together. Refused unless true. */
  @Equals(true)
  acceptTerms: true;

  /** Optional: messages from the platform about the account and plan. Off unless chosen. */
  @IsOptional()
  @IsBoolean()
  platformNotifications?: boolean;
}
