import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Phone } from '../../common/decorators/phone.decorator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';

/** What a coach may change; anything not sent stays as it is. */
export class UpdateClientDto {
  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @Phone()
  phone?: string;
}
