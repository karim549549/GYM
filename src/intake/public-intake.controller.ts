import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { IntakeTokenParamsDto } from './dto/intake-token-params.dto';
import { SubmitIntakeDto } from './dto/submit-intake.dto';
import { IntakeService } from './intake.service';
import type { PublicIntakeView } from './interfaces/intake.interface';

/**
 * What a client does from their link. Nobody is signed in: the secret in the address is the only
 * credential, so these routes are open (`@Public`) and must never be given anything wider.
 */
@Public()
@Controller('intake')
export class PublicIntakeController {
  constructor(private readonly intake: IntakeService) {}

  @Get(':token')
  openForm(@Param() params: IntakeTokenParamsDto): Promise<PublicIntakeView> {
    return this.intake.openForm(params.token);
  }

  @Post(':token')
  submit(
    @Param() params: IntakeTokenParamsDto,
    @Body() dto: SubmitIntakeDto,
  ): Promise<{ submittedAt: Date }> {
    return this.intake.submit(params.token, dto.answers, dto.consents);
  }
}
