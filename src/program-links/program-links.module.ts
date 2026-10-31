import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { ExercisesModule } from '../exercises/exercises.module';
import { PlansModule } from '../plans/plans.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ProgramLinksQueryHandler } from './handlers/program-links-query.handler';
import { ProgramAccessResetOrchestrator } from './orchestration/program-access-reset.orchestrator';
import { ProgramClaimOrchestrator } from './orchestration/program-claim.orchestrator';
import { ProgramGateOrchestrator } from './orchestration/program-gate.orchestrator';
import { ProgramLinkCreationOrchestrator } from './orchestration/program-link-creation.orchestrator';
import { ProgramLinkRotationOrchestrator } from './orchestration/program-link-rotation.orchestrator';
import { ProgramLoginOrchestrator } from './orchestration/program-login.orchestrator';
import { PublicProgramOrchestrator } from './orchestration/public-program.orchestrator';
import { ProgramLockPolicy } from './policies/program-lock.policy';
import { ProgramLinksController } from './program-links.controller';
import { ProgramLinksService } from './program-links.service';
import { PublicProgramController } from './public-program.controller';

@Module({
  imports: [ClientsModule, ExercisesModule, PlansModule, WorkspacesModule],
  controllers: [ProgramLinksController, PublicProgramController],
  providers: [
    ProgramLinksService,
    ProgramLinksQueryHandler,
    ProgramLinkCreationOrchestrator,
    ProgramAccessResetOrchestrator,
    ProgramLinkRotationOrchestrator,
    ProgramGateOrchestrator,
    ProgramClaimOrchestrator,
    ProgramLoginOrchestrator,
    PublicProgramOrchestrator,
    ProgramLockPolicy,
  ],
})
export class ProgramLinksModule {}
