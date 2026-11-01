import { NotFoundException } from '@nestjs/common';

export class PaymentNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'PAYMENT_NOT_FOUND',
      message: 'The payment does not exist',
    });
  }
}
