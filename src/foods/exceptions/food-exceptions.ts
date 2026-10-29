import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class FoodNotFoundException extends NotFoundException {
  constructor() {
    super({ code: 'FOOD_NOT_FOUND', message: 'The food does not exist' });
  }
}

/** A library food is the same for everyone, so no coach changes it. */
export class FoodNotEditableException extends ForbiddenException {
  constructor() {
    super({
      code: 'FOOD_NOT_EDITABLE',
      message: 'A library food cannot be changed; add your own instead',
    });
  }
}

export class InvalidFoodException extends UnprocessableEntityException {
  constructor(problems: string[]) {
    super({
      code: 'INVALID_FOOD',
      message: 'The numbers of this food need another look',
      details: problems,
    });
  }
}
