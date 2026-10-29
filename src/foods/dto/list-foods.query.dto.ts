import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { FoodCategory } from '../enums/food-category.enum';

export class ListFoodsQueryDto extends PaginationQueryDto {
  /** Part of the Arabic or the English name. */
  @Trimmed()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsEnum(FoodCategory)
  category?: FoodCategory;

  /** Query strings are text, so this is 'true' or 'false'. */
  @IsOptional()
  @IsIn(['true', 'false'])
  includeInactive?: 'true' | 'false';
}
