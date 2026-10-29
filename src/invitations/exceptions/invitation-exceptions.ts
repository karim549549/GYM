import {
  ConflictException,
  GoneException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class InvitationNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'INVITATION_NOT_FOUND',
      message: 'The invitation does not exist',
    });
  }
}

/** Already accepted, declined or taken back. */
export class InvitationNotPendingException extends ConflictException {
  constructor() {
    super({
      code: 'INVITATION_NOT_PENDING',
      message: 'This invitation has already been answered or taken back',
    });
  }
}

export class InvitationExpiredException extends GoneException {
  constructor() {
    super({
      code: 'INVITATION_EXPIRED',
      message: 'This invitation has expired, ask the owner for a new one',
    });
  }
}

export class InvitationLimitReachedException extends UnprocessableEntityException {
  constructor() {
    super({
      code: 'INVITATION_LIMIT_REACHED',
      message: 'Too many invitations are waiting for an answer',
    });
  }
}
