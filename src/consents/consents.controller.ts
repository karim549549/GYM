import { RequireAction } from '../common/decorators/require-action.decorator';
import { WorkspaceAction } from '../members/enums/workspace-action.enum';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import type { Principal } from '../auth/interfaces/principal.interface';
import { ClientParamsDto } from '../clients/dto/client-params.dto';
import { CurrentPrincipal } from '../common/decorators/current-principal.decorator';
import { CurrentWorkspaceId } from '../common/decorators/current-workspace-id.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ConsentsService } from './consents.service';
import {
  ChangePersonConsentDto,
  WithdrawClientConsentDto,
} from './dto/consent.dto';
import { ConsentSource } from './enums/consent-source.enum';
import type { ConsentState, ConsentText } from './interfaces/consent.interface';

/** What people and clients have agreed to. */
@Controller()
export class ConsentsController {
  constructor(private readonly consents: ConsentsService) {}

  /** The wording of every consent, for the screens that ask for them. */
  @Public()
  @Get('consents/texts')
  texts(): {
    version: string;
    client: ConsentText[];
    person: ConsentText[];
  } {
    return this.consents.texts();
  }

  @Get('consents/me')
  mine(@CurrentPrincipal() principal: Principal): Promise<ConsentState[]> {
    return this.consents.personStates(principal.personId);
  }

  @Put('consents/me')
  async changeMine(
    @CurrentPrincipal() principal: Principal,
    @Body() dto: ChangePersonConsentDto,
  ): Promise<ConsentState[]> {
    await this.consents.recordForPerson(
      principal.personId,
      [{ type: dto.type, granted: dto.granted }],
      ConsentSource.ACCOUNT,
    );
    return this.consents.personStates(principal.personId);
  }

  @RequireAction(WorkspaceAction.CLIENTS_READ)
  @Get('clients/:id/consents')
  ofClient(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: ClientParamsDto,
  ): Promise<ConsentState[]> {
    return this.consents.clientStates(workspaceId, params.id);
  }

  /** The client told the coach they withdraw. The coach can record that; only the client can agree. */
  @RequireAction(WorkspaceAction.CLIENTS_WRITE)
  @Post('clients/:id/consents/withdraw')
  @HttpCode(200)
  withdraw(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: ClientParamsDto,
    @Body() dto: WithdrawClientConsentDto,
  ): Promise<ConsentState[]> {
    return this.consents.withdrawOnBehalf(workspaceId, params.id, dto.type);
  }
}
