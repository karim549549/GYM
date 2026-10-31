import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { ProgramSession } from '../common/decorators/program-session.decorator';
import { ProgramCredentialsDto } from './dto/program-credentials.dto';
import { ProgramTokenParamsDto } from './dto/program-token-params.dto';
import type {
  ProgramGateView,
  ProgramSessionResult,
  PublicProgramView,
} from './interfaces/program-link.interface';
import { ProgramLinksService } from './program-links.service';

/**
 * What a client does from their program link. Nobody is signed in with us: the address only finds the
 * link, and the mobile number and password they type (or the session their device then holds) prove who
 * they are. Open (`@Public`) for that reason, and nothing wider may be given to these routes.
 */
@Public()
@Controller('program')
export class PublicProgramController {
  constructor(private readonly programLinks: ProgramLinksService) {}

  @Get(':token/gate')
  gate(@Param() params: ProgramTokenParamsDto): Promise<ProgramGateView> {
    return this.programLinks.gate(params.token);
  }

  @Post(':token/claim')
  @HttpCode(200)
  claim(
    @Param() params: ProgramTokenParamsDto,
    @Body() dto: ProgramCredentialsDto,
  ): Promise<ProgramSessionResult> {
    return this.programLinks.claim(params.token, dto.phone, dto.password);
  }

  @Post(':token/login')
  @HttpCode(200)
  login(
    @Param() params: ProgramTokenParamsDto,
    @Body() dto: ProgramCredentialsDto,
  ): Promise<ProgramSessionResult> {
    return this.programLinks.login(params.token, dto.phone, dto.password);
  }

  @Get(':token')
  open(
    @Param() params: ProgramTokenParamsDto,
    @ProgramSession() session: string | undefined,
  ): Promise<PublicProgramView> {
    return this.programLinks.open(params.token, session);
  }
}
