import { Injectable } from '@nestjs/common';
import type {
  ProgramGateView,
  ProgramLinkView,
  ProgramSessionResult,
  PublicProgramView,
} from './interfaces/program-link.interface';
import { ProgramAccessResetOrchestrator } from './orchestration/program-access-reset.orchestrator';
import { ProgramClaimOrchestrator } from './orchestration/program-claim.orchestrator';
import { ProgramGateOrchestrator } from './orchestration/program-gate.orchestrator';
import { ProgramLinkCreationOrchestrator } from './orchestration/program-link-creation.orchestrator';
import { ProgramLinkRotationOrchestrator } from './orchestration/program-link-rotation.orchestrator';
import { ProgramLoginOrchestrator } from './orchestration/program-login.orchestrator';
import { PublicProgramOrchestrator } from './orchestration/public-program.orchestrator';

/** The program links module's interface: the address a client opens to see their plans. */
@Injectable()
export class ProgramLinksService {
  constructor(
    private readonly creation: ProgramLinkCreationOrchestrator,
    private readonly accessReset: ProgramAccessResetOrchestrator,
    private readonly rotation: ProgramLinkRotationOrchestrator,
    private readonly gateView: ProgramGateOrchestrator,
    private readonly claiming: ProgramClaimOrchestrator,
    private readonly loggingIn: ProgramLoginOrchestrator,
    private readonly program: PublicProgramOrchestrator,
  ) {}

  link(workspaceId: string, clientId: string): Promise<ProgramLinkView> {
    return this.creation.execute(workspaceId, clientId);
  }

  resetAccess(workspaceId: string, clientId: string): Promise<ProgramLinkView> {
    return this.accessReset.execute(workspaceId, clientId);
  }

  rotate(workspaceId: string, clientId: string): Promise<ProgramLinkView> {
    return this.rotation.execute(workspaceId, clientId);
  }

  gate(token: string): Promise<ProgramGateView> {
    return this.gateView.execute(token);
  }

  claim(
    token: string,
    phone: string,
    password: string,
  ): Promise<ProgramSessionResult> {
    return this.claiming.execute(token, phone, password);
  }

  login(
    token: string,
    phone: string,
    password: string,
  ): Promise<ProgramSessionResult> {
    return this.loggingIn.execute(token, phone, password);
  }

  open(token: string, session: string | undefined): Promise<PublicProgramView> {
    return this.program.execute(token, session);
  }
}
