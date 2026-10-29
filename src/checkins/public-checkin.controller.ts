import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ChangeClientConsentDto } from '../consents/dto/consent.dto';
import type { ConsentState } from '../consents/interfaces/consent.interface';
import { Public } from '../common/decorators/public.decorator';
import { CheckinsService } from './checkins.service';
import { CheckinTokenParamsDto } from './dto/checkin-token-params.dto';
import { SubmitCheckinDto } from './dto/submit-checkin.dto';
import type { PublicCheckinView } from './interfaces/checkin.interface';

/**
 * What a client does from their check-in link. Nobody is signed in: the secret in the address is
 * the only credential, so these routes are open (`@Public`) and must never be given anything wider.
 */
@Public()
@Controller('checkin')
export class PublicCheckinController {
  constructor(private readonly checkins: CheckinsService) {}

  @Get(':token')
  openForm(@Param() params: CheckinTokenParamsDto): Promise<PublicCheckinView> {
    return this.checkins.openForm(params.token);
  }

  @Post(':token')
  submit(
    @Param() params: CheckinTokenParamsDto,
    @Body() dto: SubmitCheckinDto,
  ): Promise<{ submittedAt: Date }> {
    return this.checkins.submit(params.token, dto.answers);
  }

  @Get(':token/consents')
  consents(@Param() params: CheckinTokenParamsDto): Promise<ConsentState[]> {
    return this.checkins.consentStates(params.token);
  }

  /** The client taking back (or giving) a choice. Works however old the link is. */
  @Put(':token/consents')
  changeConsent(
    @Param() params: CheckinTokenParamsDto,
    @Body() dto: ChangeClientConsentDto,
  ): Promise<ConsentState[]> {
    return this.checkins.changeConsent(params.token, dto.type, dto.granted);
  }
}
