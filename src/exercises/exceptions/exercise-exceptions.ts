import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class ExerciseNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'EXERCISE_NOT_FOUND',
      message: 'The exercise does not exist',
    });
  }
}

/** A library exercise is the same for everyone, so no coach changes it. */
export class ExerciseNotEditableException extends ForbiddenException {
  constructor() {
    super({
      code: 'EXERCISE_NOT_EDITABLE',
      message: 'A library exercise cannot be changed; add your own instead',
    });
  }
}

export class MuscleListedTwiceException extends UnprocessableEntityException {
  constructor() {
    super({
      code: 'MUSCLE_LISTED_TWICE',
      message: 'The main muscle cannot also be a secondary one',
    });
  }
}
