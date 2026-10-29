import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Phone } from '../../common/decorators/phone.decorator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';

export class CreateClientDto {
  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName: string;

  @Phone()
  phone: string;
}
