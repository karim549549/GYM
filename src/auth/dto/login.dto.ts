import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Phone } from '../../common/decorators/phone.decorator';

export class LoginDto {
  @Phone()
  phone: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password: string;
}
