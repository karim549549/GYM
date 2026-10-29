import { Phone } from '../../common/decorators/phone.decorator';

export class ResendDto {
  @Phone()
  phone: string;
}
