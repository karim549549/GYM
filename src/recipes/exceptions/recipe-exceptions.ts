import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
export class RecipeNotFoundException extends NotFoundException {
  constructor() {
    super({ code: 'RECIPE_NOT_FOUND', message: 'Recipe not found' });
  }
}
export class RecipeNotEditableException extends ForbiddenException {
  constructor() {
    super({
      code: 'RECIPE_NOT_EDITABLE',
      message: 'Shared recipes cannot be edited',
    });
  }
}
export class InvalidRecipeException extends UnprocessableEntityException {
  constructor(details: string[]) {
    super({ code: 'INVALID_RECIPE', message: 'Invalid recipe', details });
  }
}
