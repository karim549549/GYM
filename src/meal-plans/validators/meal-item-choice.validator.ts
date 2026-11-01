import {
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';
@ValidatorConstraint({ name: 'mealItemChoice', async: false })
export class MealItemChoiceValidator implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const item = args.object as { foodId?: unknown; recipeId?: unknown };
    return Number(item.foodId != null) + Number(item.recipeId != null) === 1;
  }
  defaultMessage(): string {
    return 'Exactly one of foodId or recipeId must be supplied';
  }
}
