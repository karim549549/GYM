import { NotFoundException } from '@nestjs/common';

export class PaymentChannelNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'PAYMENT_CHANNEL_NOT_FOUND',
      message: 'The payment method does not exist',
    });
  }
}
