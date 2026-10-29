import {
  ConflictException,
  GoneException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class IntakeLinkNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'INTAKE_LINK_NOT_FOUND',
      message: 'This link does not exist',
    });
  }
}

export class IntakeLinkExpiredException extends GoneException {
  constructor() {
    super({
      code: 'INTAKE_LINK_EXPIRED',
      message: 'This link has expired, ask your coach for a new one',
    });
  }
}

export class IntakeAlreadySubmittedException extends ConflictException {
  constructor() {
    super({
      code: 'INTAKE_ALREADY_SUBMITTED',
      message: 'These details were already handed in',
    });
  }
}

export class InvalidIntakeAnswersException extends UnprocessableEntityException {
  constructor(problems: string[]) {
    super({
      code: 'INVALID_INTAKE_ANSWERS',
      message: 'Some answers need another look',
      details: problems,
    });
  }
}

export class IntakeNotSubmittedException extends NotFoundException {
  constructor() {
    super({
      code: 'INTAKE_NOT_SUBMITTED',
      message: 'This client has not handed in their details yet',
    });
  }
}
