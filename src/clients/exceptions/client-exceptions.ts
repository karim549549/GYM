import { ConflictException, NotFoundException } from '@nestjs/common';

export class ClientNotFoundException extends NotFoundException {
  constructor() {
    super({ code: 'CLIENT_NOT_FOUND', message: 'The client does not exist' });
  }
}

export class ClientAlreadyExistsException extends ConflictException {
  private static readonly CONSTRAINT = 'clients_workspace_phone_key';

  constructor() {
    super({
      code: 'CLIENT_ALREADY_EXISTS',
      message: 'You already have a client with this phone number',
    });
  }

  /** Whether the database refused a write because the workspace already has that number. */
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
        constraint === ClientAlreadyExistsException.CONSTRAINT
      ) {
        return true;
      }
    }
    return false;
  }
}
