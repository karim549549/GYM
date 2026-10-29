import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class SubscriptionNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'SUBSCRIPTION_NOT_FOUND',
      message: 'The subscription does not exist',
    });
  }
}

export class ClientHasActiveSubscriptionException extends ConflictException {
  private static readonly CONSTRAINT = 'subscriptions_one_live_per_client_idx';

  constructor() {
    super({
      code: 'CLIENT_HAS_ACTIVE_SUBSCRIPTION',
      message: 'This client already has a subscription that is running',
    });
  }

  /** Whether the database refused a write because the client already has a live subscription. */
  static causes(error: unknown): boolean {
    for (
      let link: unknown = error, depth = 0;
      link && depth < 5;
      link = (link as { cause?: unknown }).cause, depth += 1
    ) {
      const { code, constraint } = link as {
        code?: string;
        constraint?: string;
      };
      if (
        code === '23505' &&
        constraint === ClientHasActiveSubscriptionException.CONSTRAINT
      ) {
        return true;
      }
    }
    return false;
  }
}

export class PackageNotSoldException extends UnprocessableEntityException {
  constructor() {
    super({
      code: 'PACKAGE_NOT_SOLD',
      message: 'This package is no longer sold',
    });
  }
}

/** Cancelled or ended: nothing about it can change any more. */
export class SubscriptionClosedException extends ConflictException {
  constructor() {
    super({
      code: 'SUBSCRIPTION_CLOSED',
      message: 'This subscription is over',
    });
  }
}

export class SubscriptionNotActiveException extends ConflictException {
  constructor() {
    super({
      code: 'SUBSCRIPTION_NOT_ACTIVE',
      message: 'Only a subscription that is running can be frozen',
    });
  }
}

export class SubscriptionNotFrozenException extends ConflictException {
  constructor() {
    super({
      code: 'SUBSCRIPTION_NOT_FROZEN',
      message: 'This subscription is not frozen',
    });
  }
}

export class ResumeBeforeFreezeException extends UnprocessableEntityException {
  constructor() {
    super({
      code: 'RESUME_BEFORE_FREEZE',
      message: 'A subscription cannot resume before the day it was frozen',
    });
  }
}

export class EndBeforeStartException extends UnprocessableEntityException {
  constructor() {
    super({
      code: 'END_BEFORE_START',
      message: 'The end date cannot be before the start date',
    });
  }
}

export class PaymentExceedsDueException extends UnprocessableEntityException {
  constructor() {
    super({
      code: 'PAYMENT_EXCEEDS_DUE',
      message: 'This is more than what is still owed on the subscription',
    });
  }
}
