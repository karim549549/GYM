import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Phone } from '../../common/decorators/phone.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { InvitationStatus } from '../enums/invitation-status.enum';

export class CreateInvitationDto {
  @Phone()
  phone: string;
}

export class InvitationParamsDto {
  @IsUUID()
  id: string;
}

export class ListInvitationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(InvitationStatus)
  status?: InvitationStatus;
}
