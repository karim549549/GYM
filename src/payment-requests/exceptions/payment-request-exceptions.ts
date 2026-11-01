import {
  ConflictException,
  GoneException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class PaymentRequestNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'PAYMENT_REQUEST_NOT_FOUND',
      message: 'This payment link does not exist',
    });
  }
}

export class PaymentRequestExpiredException extends GoneException {
  constructor() {
    super({
      code: 'PAYMENT_REQUEST_EXPIRED',
      message: 'This payment link has expired',
    });
  }
}

export class PaymentRequestAlreadyPaidException extends ConflictException {
  constructor() {
    super({
      code: 'PAYMENT_REQUEST_ALREADY_PAID',
      message: 'This payment link was already marked as paid',
    });
  }
}

export class PaymentRequestExceedsDueException extends UnprocessableEntityException {
  constructor() {
    super({
      code: 'PAYMENT_REQUEST_EXCEEDS_DUE',
      message: 'This is more than what is still owed on the subscription',
    });
  }
}

/** A cancelled subscription is not billed any more, so nothing can be asked for it. */
export class PaymentRequestSubscriptionClosedException extends UnprocessableEntityException {
  constructor() {
    super({
      code: 'PAYMENT_REQUEST_SUBSCRIPTION_CLOSED',
      message: 'This subscription was cancelled',
    });
  }
}

export class PaymentRequestNotReportedException extends ConflictException {
  constructor() {
    super({
      code: 'PAYMENT_REQUEST_NOT_REPORTED',
      message: 'The client has not said they paid yet',
    });
  }
}

export class PaymentRequestAlreadyConfirmedException extends ConflictException {
  constructor() {
    super({
      code: 'PAYMENT_REQUEST_ALREADY_CONFIRMED',
      message: 'This payment was already confirmed',
    });
  }
}
