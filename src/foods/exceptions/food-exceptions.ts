import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class FoodNotFoundException extends NotFoundException {
  constructor() {
    super({ code: 'FOOD_NOT_FOUND', message: 'The food does not exist' });
  }
}

export class InvalidBarcodeException extends UnprocessableEntityException {
  constructor() {
    super({
      code: 'INVALID_BARCODE',
      message: 'A valid GS1 barcode is required',
    });
  }
}

export class FoodBarcodeExistsException extends ConflictException {
  constructor(details: unknown) {
    super({
      code: 'FOOD_BARCODE_EXISTS',
      message: 'This barcode already belongs to a visible food',
      details,
    });
  }
}

export class FoodPossibleDuplicateException extends ConflictException {
  constructor(details: unknown) {
    super({
      code: 'FOOD_POSSIBLE_DUPLICATE',
      message: 'Similar foods already exist',
      details,
    });
  }
}

export class FoodPublicationAlreadyRequestedException extends ConflictException {
  constructor() {
    super({
      code: 'FOOD_PUBLICATION_ALREADY_REQUESTED',
      message: 'A publication request is already pending',
    });
  }
}

export class FoodPublicationChangedException extends ConflictException {
  constructor() {
    super({
      code: 'FOOD_PUBLICATION_CHANGED',
      message:
        'The food was edited after it was suggested: reject this request and let the coach ask again',
    });
  }
}

export class FoodPublicationNotPendingException extends ConflictException {
  constructor() {
    super({
      code: 'FOOD_PUBLICATION_NOT_PENDING',
      message: 'This request is no longer pending',
    });
  }
}

export class FoodPublicationNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'FOOD_PUBLICATION_NOT_FOUND',
      message: 'The publication request does not exist',
    });
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
