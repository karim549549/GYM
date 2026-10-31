import { IsString, MaxLength, MinLength } from 'class-validator';
import { Phone } from '../../common/decorators/phone.decorator';

/** What a client types on their program link: the mobile number the coach has for them, and a password. */
export class ProgramCredentialsDto {
  @Phone()
  phone: string;

  // the same bounds as the password of an account; the upper one keeps hashing cheap
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
