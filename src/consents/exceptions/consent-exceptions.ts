import {
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';

/** What a client must agree to before handing in their details was not agreed. */
export class ConsentRequiredException extends UnprocessableEntityException {
  constructor(missing: string[]) {
    super({
      code: 'CONSENT_REQUIRED',
      message: 'The required consents were not given',
      details: missing,
    });
  }
}

/** A coach tried to read or use what the client has not agreed to share (or has taken back). */
export class ClientConsentRequiredException extends ForbiddenException {
  constructor(missing: string[]) {
    super({
      code: 'CLIENT_CONSENT_REQUIRED',
      message: 'The client has not given the consent this needs',
      details: missing,
    });
  }
}

export class ConsentCannotBeGivenForClientException extends ForbiddenException {
  constructor() {
    super({
      code: 'CONSENT_CANNOT_BE_GIVEN_FOR_CLIENT',
      message:
        'Only the client can agree; a coach can only record a withdrawal',
    });
  }
}
