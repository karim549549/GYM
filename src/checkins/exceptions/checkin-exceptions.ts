import {
  ConflictException,
  GoneException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class CheckinScheduleNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'CHECKIN_SCHEDULE_NOT_FOUND',
      message: 'This client has no check-in schedule',
    });
  }
}

export class CheckinNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'CHECKIN_NOT_FOUND',
      message: 'The check-in does not exist',
    });
  }
}

/** The link is real but its day has not come. */
export class CheckinNotOpenException extends ConflictException {
  constructor() {
    super({
      code: 'CHECKIN_NOT_OPEN',
      message: 'This check-in is not open yet',
    });
  }
}

export class CheckinExpiredException extends GoneException {
  constructor() {
    super({
      code: 'CHECKIN_EXPIRED',
      message: 'This check-in has expired, wait for the next one',
    });
  }
}

export class CheckinAlreadySubmittedException extends ConflictException {
  constructor() {
    super({
      code: 'CHECKIN_ALREADY_SUBMITTED',
      message: 'This check-in was already handed in',
    });
  }
}

export class InvalidCheckinAnswersException extends UnprocessableEntityException {
  constructor(problems: string[]) {
    super({
      code: 'INVALID_CHECKIN_ANSWERS',
      message: 'Some answers need another look',
      details: problems,
    });
  }
}

export class CheckinNotSubmittedException extends ConflictException {
  constructor() {
    super({
      code: 'CHECKIN_NOT_SUBMITTED',
      message: 'The client has not handed this check-in in yet',
    });
  }
}
