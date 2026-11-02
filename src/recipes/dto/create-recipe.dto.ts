import { YoutubeVideoIdValidator } from '../validators/youtube-video-id.validator';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidateNested,
} from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';
import { MealCategory } from '../../foods/enums/meal-category.enum';
import {
  RecipeAliasDto,
  RecipeIngredientDto,
  RecipePortionDto,
  RecipeStepDto,
} from './recipe-children.dto';
export class CreateRecipeDto {
  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nameAr: string;
  @Trimmed()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameEn?: string | null;
  @Trimmed()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descriptionAr?: string | null;
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100000)
  finishedWeightG: number;
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10080)
  prepMinutes?: number | null;
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10080)
  cookMinutes?: number | null;
  @IsOptional()
  @IsString()
  @Validate(YoutubeVideoIdValidator)
  youtubeVideoId?: string | null;
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(6)
  @IsEnum(MealCategory, { each: true })
  mealTags?: MealCategory[];
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients: RecipeIngredientDto[];
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RecipeStepDto)
  steps: RecipeStepDto[];
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => RecipePortionDto)
  portions: RecipePortionDto[];
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => RecipeAliasDto)
  aliases?: RecipeAliasDto[];
}
