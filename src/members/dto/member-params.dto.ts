import { IsUUID } from 'class-validator';

export class MemberParamsDto {
  @IsUUID()
  personId: string;
}
