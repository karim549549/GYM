import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class MissingTokenException extends UnauthorizedException {
  constructor() {
    super({ code: 'MISSING_TOKEN', message: 'Authentication is required' });
  }
}

export class InvalidTokenException extends UnauthorizedException {
  constructor() {
    super({
      code: 'INVALID_TOKEN',
      message: 'The token is invalid or has expired',
    });
  }
}

export class NotRegisteredException extends ForbiddenException {
  constructor() {
    super({
      code: 'NOT_REGISTERED',
      message: 'Finish registration before using the API',
    });
  }
}

export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    super({
      code: 'INVALID_CREDENTIALS',
      message: 'The phone number or password is wrong',
    });
  }
}

export class PhoneNotConfirmedException extends ForbiddenException {
  constructor() {
    super({
      code: 'PHONE_NOT_CONFIRMED',
      message: 'Confirm your phone number with the code we sent, then sign in',
    });
  }
}

export class PhoneAlreadyRegisteredException extends ConflictException {
  constructor() {
    super({
      code: 'PHONE_ALREADY_REGISTERED',
      message: 'An account with this phone number already exists',
    });
  }
}

export class InvalidVerificationCodeException extends BadRequestException {
  constructor() {
    super({
      code: 'INVALID_VERIFICATION_CODE',
      message: 'The code is wrong or has expired',
    });
  }
}

export class WeakPasswordException extends UnprocessableEntityException {
  constructor() {
    super({
      code: 'WEAK_PASSWORD',
      message: 'Choose a stronger password',
    });
  }
}

export class InvalidRefreshTokenException extends UnauthorizedException {
  constructor() {
    super({
      code: 'INVALID_REFRESH_TOKEN',
      message: 'The session has ended, sign in again',
    });
  }
}

export class AuthRateLimitedException extends HttpException {
  constructor() {
    super(
      {
        code: 'AUTH_RATE_LIMITED',
        message: 'Too many attempts, try again later',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class AuthProviderUnavailableException extends ServiceUnavailableException {
  constructor() {
    super({
      code: 'AUTH_PROVIDER_UNAVAILABLE',
      message: 'Sign-in is temporarily unavailable, try again shortly',
    });
  }
}

export class NoWorkspaceException extends ForbiddenException {
  constructor() {
    super({
      code: 'NO_WORKSPACE',
      message: 'Create your workspace first',
    });
  }
}

export class WorkspaceRequiredException extends BadRequestException {
  constructor() {
    super({
      code: 'WORKSPACE_REQUIRED',
      message: 'Send the workspace to act in with the x-workspace-id header',
    });
  }
}

export class WorkspaceForbiddenException extends ForbiddenException {
  constructor() {
    super({
      code: 'WORKSPACE_FORBIDDEN',
      message: 'You are not a member of this workspace',
    });
  }
}

export class InvalidHookSignatureException extends UnauthorizedException {
  constructor() {
    super({
      code: 'INVALID_HOOK_SIGNATURE',
      message: 'The request is not signed by the identity provider',
    });
  }
}

export class InvalidHookPayloadException extends BadRequestException {
  constructor() {
    super({
      code: 'INVALID_HOOK_PAYLOAD',
      message: 'The request does not carry a phone number and a code',
    });
  }
}
