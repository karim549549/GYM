import { IsUUID } from 'class-validator';

export class InvoiceParamsDto {
  @IsUUID()
  id: string;
}
