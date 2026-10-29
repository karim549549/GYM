import { IsBoolean, IsEnum, IsIn, IsOptional } from 'class-validator';
import { ClientConsentType } from '../enums/client-consent-type.enum';
import { PersonConsentType } from '../enums/person-consent-type.enum';

export class WithdrawClientConsentDto {
  @IsEnum(ClientConsentType)
  type: ClientConsentType;
}

/** An account holder can change only the optional choice; the terms are what the account stands on. */
export class ChangePersonConsentDto {
  @IsIn([PersonConsentType.PLATFORM_NOTIFICATIONS])
  type: PersonConsentType.PLATFORM_NOTIFICATIONS;

  @IsBoolean()
  granted: boolean;
}

/** The choices on a form a client hands in. The two required ones are checked by the consents module. */
export class ClientConsentsDto {
  @IsBoolean()
  dataProcessing: boolean;

  @IsBoolean()
  healthData: boolean;

  @IsOptional()
  @IsBoolean()
  whatsappNotifications?: boolean;
}

export class ChangeClientConsentDto {
  @IsEnum(ClientConsentType)
  type: ClientConsentType;

  @IsBoolean()
  granted: boolean;
}
