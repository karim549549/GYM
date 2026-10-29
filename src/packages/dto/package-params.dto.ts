import { IsUUID } from 'class-validator';

export class PackageParamsDto {
  @IsUUID()
  id: string;
}
