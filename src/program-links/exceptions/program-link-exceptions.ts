import {
  ConflictException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

export class ProgramLinkNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'PROGRAM_LINK_NOT_FOUND',
      message: 'This link does not exist',
    });
  }
}

/** The mobile number or the password is wrong: which one is never said. */
export class ProgramCredentialsInvalidException extends UnauthorizedException {
  constructor() {
    super({
      code: 'PROGRAM_CREDENTIALS_INVALID',
      message: 'The mobile number or the password is not right',
    });
  }
}

export class ProgramLockedException extends HttpException {
  constructor() {
    super(
      {
        code: 'PROGRAM_LOCKED',
        message: 'Too many tries, wait a few minutes and try again',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class ProgramAlreadyClaimedException extends ConflictException {
  constructor() {
    super({
      code: 'PROGRAM_ALREADY_CLAIMED',
      message: 'A password was already chosen, sign in with it',
    });
  }
}

export class ProgramSessionRequiredException extends UnauthorizedException {
  constructor() {
    super({
      code: 'PROGRAM_SESSION_REQUIRED',
      message: 'Sign in to see your program',
    });
  }
}
