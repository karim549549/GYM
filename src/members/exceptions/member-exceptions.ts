import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

export class MemberNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'MEMBER_NOT_FOUND',
      message: 'You are not a member of this workspace',
    });
  }
}

export class ActionNotAllowedException extends ForbiddenException {
  constructor(action: string) {
    super({
      code: 'ROLE_NOT_ALLOWED',
      message: 'Your role in this workspace does not allow this',
      details: [action],
    });
  }
}

/** A person has one place in a workspace: the database's unique rule on (workspace, person) is the last word. */
export class AlreadyAMemberException extends ConflictException {
  static readonly CONSTRAINT = 'workspace_members_workspace_person_key';

  constructor() {
    super({
      code: 'ALREADY_A_MEMBER',
      message: 'This person already belongs to the workspace, with one role',
    });
  }

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
        constraint === AlreadyAMemberException.CONSTRAINT
      ) {
        return true;
      }
    }
    return false;
  }
}

export class OwnerCannotBeRemovedException extends ForbiddenException {
  constructor() {
    super({
      code: 'OWNER_CANNOT_BE_REMOVED',
      message:
        'The owner cannot be removed or leave: ownership has to be moved first',
    });
  }
}
