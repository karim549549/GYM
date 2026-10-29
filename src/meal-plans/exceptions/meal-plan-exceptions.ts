import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class MealPlanNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'MEAL_PLAN_NOT_FOUND',
      message: 'The meal plan does not exist',
    });
  }
}

/** An ended plan is a record of what the client followed; it no longer changes. */
export class MealPlanEndedException extends ConflictException {
  constructor() {
    super({ code: 'MEAL_PLAN_ENDED', message: 'This meal plan has ended' });
  }
}

export class MealPlanIsTemplateException extends ConflictException {
  constructor() {
    super({
      code: 'MEAL_PLAN_IS_TEMPLATE',
      message: 'A template is copied for a client, not started',
    });
  }
}

export class MealPlanNotDraftException extends ConflictException {
  constructor() {
    super({
      code: 'MEAL_PLAN_NOT_DRAFT',
      message: 'Only a draft meal plan can be started',
    });
  }
}

export class MealPlanNotActiveException extends ConflictException {
  constructor() {
    super({
      code: 'MEAL_PLAN_NOT_ACTIVE',
      message: 'Only a meal plan that is running can be ended',
    });
  }
}

export class MealPlanNotDeletableException extends ConflictException {
  constructor() {
    super({
      code: 'MEAL_PLAN_NOT_DELETABLE',
      message:
        'Only a draft or a template can be deleted; a plan that ran is kept as the client’s record',
    });
  }
}

/** Two plans were started for one client at the same moment; the second one lost. */
export class MealPlanActivationConflictException extends ConflictException {
  private static readonly CONSTRAINT = 'meal_plans_one_active_per_client_idx';

  constructor() {
    super({
      code: 'MEAL_PLAN_ACTIVATION_CONFLICT',
      message: 'This client’s meal plan was just changed, try again',
    });
  }

  /** Whether the database refused a write because the client already has an active meal plan. */
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
        constraint === MealPlanActivationConflictException.CONSTRAINT
      ) {
        return true;
      }
    }
    return false;
  }
}

export class InvalidMealPlanStructureException extends UnprocessableEntityException {
  constructor(problems: string[]) {
    super({
      code: 'INVALID_MEAL_PLAN_STRUCTURE',
      message: 'The meals of the plan need another look',
      details: problems,
    });
  }
}

export class FoodNotAvailableException extends UnprocessableEntityException {
  constructor(problems: string[]) {
    super({
      code: 'FOOD_NOT_AVAILABLE',
      message:
        'Some foods are not in your database, are no longer used, or the unit is not one of theirs',
      details: problems,
    });
  }
}
