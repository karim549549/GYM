import { ConflictException, NotFoundException } from '@nestjs/common';

export class WorkspaceAlreadyExistsException extends ConflictException {
  constructor() {
    super({
      code: 'WORKSPACE_ALREADY_EXISTS',
      message: 'You already own a workspace',
    });
  }
}

export class WorkspaceNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'WORKSPACE_NOT_FOUND',
      message: 'The workspace does not exist',
    });
  }
}
