import { IsUUID } from 'class-validator';
export class RecipeParamsDto {
  @IsUUID()
  id: string;
}
