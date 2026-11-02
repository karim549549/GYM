import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Trimmed } from '../../common/decorators/trimmed.decorator';
import { MealCategory } from '../../foods/enums/meal-category.enum';
import { RecipeScope } from '../enums/recipe-scope.enum';
export class ListRecipesQueryDto extends PaginationQueryDto {
  @Trimmed()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
  @IsOptional()
  @IsEnum(MealCategory)
  mealTag?: MealCategory;
  @IsOptional()
  @IsEnum(RecipeScope)
  scope?: RecipeScope;
  @IsOptional()
  @IsIn(['true', 'false'])
  includeInactive?: 'true' | 'false';
}
