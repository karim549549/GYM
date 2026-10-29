import { Phone } from '../../common/decorators/phone.decorator';

export class ForgotPasswordDto {
  @Phone()
  phone: string;
}
