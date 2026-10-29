import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class PlanNotFoundException extends NotFoundException {
  constructor() {
    super({ code: 'PLAN_NOT_FOUND', message: 'The plan does not exist' });
  }
}

/** An ended plan is a record of what the client did; it no longer changes. */
export class PlanEndedException extends ConflictException {
  constructor() {
    super({ code: 'PLAN_ENDED', message: 'This plan has ended' });
  }
}

export class PlanIsTemplateException extends ConflictException {
  constructor() {
    super({
      code: 'PLAN_IS_TEMPLATE',
      message: 'A template is copied for a client, not started',
    });
  }
}

export class PlanNotDraftException extends ConflictException {
  constructor() {
    super({
      code: 'PLAN_NOT_DRAFT',
      message: 'Only a draft plan can be started',
    });
  }
}

export class PlanNotActiveException extends ConflictException {
  constructor() {
    super({
      code: 'PLAN_NOT_ACTIVE',
      message: 'Only a plan that is running can be ended',
    });
  }
}

export class PlanNotDeletableException extends ConflictException {
  constructor() {
    super({
      code: 'PLAN_NOT_DELETABLE',
      message:
        'Only a draft or a template can be deleted; a plan that ran is kept as the client’s record',
    });
  }
}

/** Two plans were started for one client at the same moment; the second one lost. */
export class PlanActivationConflictException extends ConflictException {
  private static readonly CONSTRAINT = 'plans_one_active_per_client_idx';

  constructor() {
    super({
      code: 'PLAN_ACTIVATION_CONFLICT',
      message: 'This client’s plan was just changed, try again',
    });
  }

  /** Whether the database refused a write because the client already has an active plan. */
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
        constraint === PlanActivationConflictException.CONSTRAINT
      ) {
        return true;
      }
    }
    return false;
  }
}

export class PlanHasLaterWeeksException extends UnprocessableEntityException {
  constructor() {
    super({
      code: 'PLAN_HAS_LATER_WEEKS',
      message: 'The plan has days in weeks beyond the length asked for',
    });
  }
}

export class InvalidPlanStructureException extends UnprocessableEntityException {
  constructor(problems: string[]) {
    super({
      code: 'INVALID_PLAN_STRUCTURE',
      message: 'The days of the plan need another look',
      details: problems,
    });
  }
}

export class ExerciseNotAvailableException extends UnprocessableEntityException {
  constructor(problems: string[]) {
    super({
      code: 'EXERCISE_NOT_AVAILABLE',
      message: 'Some exercises are not in your library or are no longer used',
      details: problems,
    });
  }
}
