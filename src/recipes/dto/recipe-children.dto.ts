import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';
import { NutritionAliasKind } from '../../foods/enums/nutrition-alias-kind.enum';
export class RecipeIngredientDto {
  @IsUUID()
  foodId: string;
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100000)
  weightG: number;
  @Trimmed()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  noteAr?: string | null;
}
export class RecipeStepDto {
  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  instruction: string;
}
export class RecipePortionDto {
  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nameAr: string;
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100000)
  weightG: number;
  @IsBoolean()
  isDefault: boolean;
}
export class RecipeAliasDto {
  @IsEnum(NutritionAliasKind)
  kind: NutritionAliasKind;
  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  alias: string;
}
