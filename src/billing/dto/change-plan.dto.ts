import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ChangePlanDto {
  /** A plan of the catalog: free, basic, pro, basic_annual or pro_annual. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  planId: string;
}
