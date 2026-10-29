import { RequireAction } from '../common/decorators/require-action.decorator';
import { WorkspaceAction } from '../members/enums/workspace-action.enum';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
} from '@nestjs/common';
import type { Principal } from '../auth/interfaces/principal.interface';
import { CurrentPrincipal } from '../common/decorators/current-principal.decorator';
import { CurrentWorkspaceId } from '../common/decorators/current-workspace-id.decorator';
import { UpdateMemberProfileDto } from './dto/update-member-profile.dto';
import type { MemberProfile } from './interfaces/member-profile.interface';
import { MemberParamsDto } from './dto/member-params.dto';
import type { TeamMember } from './interfaces/team-member.interface';
import { MembersService } from './members.service';

@Controller('members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  /** The signed-in coach's own profile in the workspace they are acting in. */
  @RequireAction(WorkspaceAction.MEMBER)
  @Get('me')
  findMine(
    @CurrentWorkspaceId() workspaceId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<MemberProfile> {
    return this.members.findProfile(workspaceId, principal.personId);
  }

  @RequireAction(WorkspaceAction.MEMBER)
  @Patch('me')
  updateMine(
    @CurrentWorkspaceId() workspaceId: string,
    @CurrentPrincipal() principal: Principal,
    @Body() dto: UpdateMemberProfileDto,
  ): Promise<MemberProfile> {
    return this.members.updateProfile(workspaceId, principal.personId, dto);
  }

  /** Everyone in the workspace, the owner first. */
  @RequireAction(WorkspaceAction.MEMBER)
  @Get()
  list(@CurrentWorkspaceId() workspaceId: string): Promise<TeamMember[]> {
    return this.members.list(workspaceId);
  }

  /** The signed-in member leaves the workspace. The owner cannot. */
  @RequireAction(WorkspaceAction.MEMBER)
  @Delete('me')
  @HttpCode(204)
  leave(
    @CurrentWorkspaceId() workspaceId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<void> {
    return this.members.remove(workspaceId, principal.personId);
  }

  /** The owner takes someone off the team. */
  @RequireAction(WorkspaceAction.TEAM_MANAGE)
  @Delete(':personId')
  @HttpCode(204)
  remove(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: MemberParamsDto,
  ): Promise<void> {
    return this.members.remove(workspaceId, params.personId);
  }
}
