import { Module } from '@nestjs/common';
import { MembersModule } from '../members/members.module';
import { PeopleModule } from '../people/people.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { InvitationsQueryHandler } from './handlers/invitations-query.handler';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { InvitationAcceptanceOrchestrator } from './orchestration/invitation-acceptance.orchestrator';
import { InvitationCreationOrchestrator } from './orchestration/invitation-creation.orchestrator';
import { InvitationDeclineOrchestrator } from './orchestration/invitation-decline.orchestrator';
import { InvitationListOrchestrator } from './orchestration/invitation-list.orchestrator';
import { InvitationRevocationOrchestrator } from './orchestration/invitation-revocation.orchestrator';
import { MyInvitationsOrchestrator } from './orchestration/my-invitations.orchestrator';
import { InvitationLimitPolicy } from './policies/invitation-limit.policy';
import { InvitationStatePolicy } from './policies/invitation-state.policy';

@Module({
  imports: [MembersModule, PeopleModule, WorkspacesModule],
  controllers: [InvitationsController],
  providers: [
    InvitationsService,
    InvitationsQueryHandler,
    InvitationCreationOrchestrator,
    InvitationListOrchestrator,
    InvitationRevocationOrchestrator,
    MyInvitationsOrchestrator,
    InvitationAcceptanceOrchestrator,
    InvitationDeclineOrchestrator,
    InvitationLimitPolicy,
    InvitationStatePolicy,
  ],
  exports: [InvitationsService],
})
export class InvitationsModule {}
