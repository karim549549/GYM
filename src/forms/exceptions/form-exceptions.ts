import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class InvalidFormException extends UnprocessableEntityException {
  constructor(problems: string[]) {
    super({
      code: 'INVALID_FORM',
      message: 'The questions of this form need another look',
      details: problems,
    });
  }
}

export class FormTemplateNotFoundException extends NotFoundException {
  constructor() {
    super({ code: 'FORM_NOT_FOUND', message: 'The form does not exist' });
  }
}

/** Two saves of the same form at the same moment; the second one lost. */
export class FormVersionConflictException extends ConflictException {
  private static readonly CONSTRAINTS = [
    'form_templates_purpose_version_key',
    'form_templates_one_active_idx',
  ];

  constructor() {
    super({
      code: 'FORM_VERSION_CONFLICT',
      message: 'This form was just saved by someone else, try again',
    });
  }

  /** Whether the database refused a write because another version was made at the same moment. */
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
        constraint !== undefined &&
        FormVersionConflictException.CONSTRAINTS.includes(constraint)
      ) {
        return true;
      }
    }
    return false;
  }
}
