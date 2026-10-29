import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

export class PlatformPlanNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'PLATFORM_PLAN_NOT_FOUND',
      message: 'There is no such plan',
    });
  }
}

export class AlreadyOnFreePlanException extends ConflictException {
  constructor() {
    super({
      code: 'ALREADY_ON_FREE_PLAN',
      message: 'You are already on the free plan',
    });
  }
}

/** The plan asked for has fewer places than the coach has clients. */
export class PlanLimitBelowClientsException extends ConflictException {
  constructor() {
    super({
      code: 'PLAN_LIMIT_BELOW_CLIENTS',
      message:
        'You have more clients than this plan allows; remove some or choose a bigger plan',
    });
  }
}

export class InvoiceNotFoundException extends NotFoundException {
  constructor() {
    super({ code: 'INVOICE_NOT_FOUND', message: 'The invoice does not exist' });
  }
}

export class InvoiceNotOpenException extends ConflictException {
  constructor() {
    super({
      code: 'INVOICE_NOT_OPEN',
      message: 'This invoice was already paid or cancelled',
    });
  }
}

export class PlatformAdminOnlyException extends ForbiddenException {
  constructor() {
    super({
      code: 'PLATFORM_ADMIN_ONLY',
      message: 'Only the platform’s own people can do this',
    });
  }
}
