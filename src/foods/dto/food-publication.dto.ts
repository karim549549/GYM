import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { FoodPublicationStatus } from '../enums/food-publication-status.enum';

export class ListFoodPublicationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(FoodPublicationStatus)
  status?: FoodPublicationStatus;
}

export class ApproveFoodPublicationDto {
  @Trimmed()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class RejectFoodPublicationDto {
  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  note: string;
}

export class DuplicateFoodPublicationDto extends ApproveFoodPublicationDto {
  @IsUUID()
  duplicateOfFoodId: string;
}
