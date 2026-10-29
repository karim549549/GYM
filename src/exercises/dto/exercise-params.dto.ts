import { IsUUID } from 'class-validator';

export class ExerciseParamsDto {
  @IsUUID()
  id: string;
}
