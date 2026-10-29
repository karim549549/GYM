import { Module } from '@nestjs/common';
import { PeopleModule } from '../people/people.module';
import { MembersQueryHandler } from './handlers/members-query.handler';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { MemberProfileUpdateOrchestrator } from './orchestration/member-profile-update.orchestrator';
import { MemberAdditionOrchestrator } from './orchestration/member-addition.orchestrator';
import { MemberProfileOrchestrator } from './orchestration/member-profile.orchestrator';
import { MemberRemovalOrchestrator } from './orchestration/member-removal.orchestrator';
import { MembershipCheckOrchestrator } from './orchestration/membership-check.orchestrator';
import { TeamListOrchestrator } from './orchestration/team-list.orchestrator';
import { WorkspaceActionCheckOrchestrator } from './orchestration/workspace-action-check.orchestrator';
import { WorkspacePermissionPolicy } from './policies/workspace-permission.policy';

@Module({
  imports: [PeopleModule],
  controllers: [MembersController],
  providers: [
    MembersService,
    MembersQueryHandler,
    MemberProfileOrchestrator,
    MemberProfileUpdateOrchestrator,
    TeamListOrchestrator,
    MemberAdditionOrchestrator,
    MemberRemovalOrchestrator,
    MembershipCheckOrchestrator,
    WorkspaceActionCheckOrchestrator,
    WorkspacePermissionPolicy,
  ],
  exports: [MembersService],
})
export class MembersModule {}
