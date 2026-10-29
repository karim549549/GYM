import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { Principal } from '../auth/interfaces/principal.interface';
import { CurrentPrincipal } from '../common/decorators/current-principal.decorator';
import { CurrentWorkspaceId } from '../common/decorators/current-workspace-id.decorator';
import { RequireAction } from '../common/decorators/require-action.decorator';
import type { PaginatedResponse } from '../common/handlers/base-query.handler';
import { WorkspaceAction } from '../members/enums/workspace-action.enum';
import type { WorkspaceRole } from '../members/enums/workspace-role.enum';
import {
  CreateInvitationDto,
  InvitationParamsDto,
  ListInvitationsQueryDto,
} from './dto/invitation.dto';
import type {
  InvitationRecord,
  MyInvitation,
} from './interfaces/invitation.interface';
import { InvitationsService } from './invitations.service';

/** Inviting people to a workspace, and answering. */
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  /** The owner invites a phone number to join as an assistant. */
  @RequireAction(WorkspaceAction.TEAM_MANAGE)
  @Post()
  create(
    @CurrentWorkspaceId() workspaceId: string,
    @CurrentPrincipal() principal: Principal,
    @Body() dto: CreateInvitationDto,
  ): Promise<InvitationRecord> {
    return this.invitations.create(workspaceId, principal.personId, dto.phone);
  }

  @RequireAction(WorkspaceAction.TEAM_MANAGE)
  @Get()
  list(
    @CurrentWorkspaceId() workspaceId: string,
    @Query() query: ListInvitationsQueryDto,
  ): Promise<PaginatedResponse<InvitationRecord>> {
    return this.invitations.list(
      workspaceId,
      query.status,
      query.page,
      query.limit,
    );
  }

  /** What is waiting for the signed-in person, in any workspace. Needs no workspace of their own. */
  @Get('mine')
  mine(@CurrentPrincipal() principal: Principal): Promise<MyInvitation[]> {
    return this.invitations.mine(principal.personId);
  }

  @Post(':id/accept')
  @HttpCode(200)
  accept(
    @CurrentPrincipal() principal: Principal,
    @Param() params: InvitationParamsDto,
  ): Promise<{ workspaceId: string; role: WorkspaceRole }> {
    return this.invitations.accept(principal.personId, params.id);
  }

  @Post(':id/decline')
  @HttpCode(204)
  decline(
    @CurrentPrincipal() principal: Principal,
    @Param() params: InvitationParamsDto,
  ): Promise<void> {
    return this.invitations.decline(principal.personId, params.id);
  }

  @RequireAction(WorkspaceAction.TEAM_MANAGE)
  @Delete(':id')
  @HttpCode(204)
  revoke(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: InvitationParamsDto,
  ): Promise<void> {
    return this.invitations.revoke(workspaceId, params.id);
  }
}
