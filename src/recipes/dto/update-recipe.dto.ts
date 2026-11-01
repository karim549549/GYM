import { PartialType } from '@nestjs/swagger';
import { IsBoolean, ValidateIf } from 'class-validator';
import { CreateRecipeDto } from './create-recipe.dto';
export class UpdateRecipeDto extends PartialType(CreateRecipeDto, {
  skipNullProperties: false,
}) {
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}
