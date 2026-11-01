import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';
export class CopyRecipeDto {
  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nameAr?: string;
}
