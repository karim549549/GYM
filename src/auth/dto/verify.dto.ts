import { IsNumberString, Length } from 'class-validator';
import { Phone } from '../../common/decorators/phone.decorator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';

export class VerifyDto {
  @Phone()
  phone: string;

  // Supabase codes are 4 to 10 digits; the project decides the length
  @Trimmed()
  @IsNumberString({ no_symbols: true })
  @Length(4, 10)
  code: string;
}
