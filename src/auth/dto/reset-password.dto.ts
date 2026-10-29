import {
  IsNumberString,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Phone } from '../../common/decorators/phone.decorator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';

export class ResetPasswordDto {
  @Phone()
  phone: string;

  // the code Supabase sent to that phone
  @Trimmed()
  @IsNumberString({ no_symbols: true })
  @Length(4, 10)
  code: string;

  // bcrypt, which Supabase uses, ignores everything past 72 bytes
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}
