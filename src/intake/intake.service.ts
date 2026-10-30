import { Injectable } from '@nestjs/common';
import type { ClientConsentsDto } from '../consents/dto/consent.dto';
import type {
  IntakeLinkView,
  IntakeResponseView,
  PublicIntakeView,
} from './interfaces/intake.interface';
import { IntakeAnswersOrchestrator } from './orchestration/intake-answers.orchestrator';
import { IntakeLinkCreationOrchestrator } from './orchestration/intake-link-creation.orchestrator';
import { IntakeSubmissionOrchestrator } from './orchestration/intake-submission.orchestrator';
import { PublicIntakeFormOrchestrator } from './orchestration/public-intake-form.orchestrator';

/** The intake module's interface: how a client hands their details to a coach. */
@Injectable()
export class IntakeService {
  constructor(
    private readonly linkCreation: IntakeLinkCreationOrchestrator,
    private readonly publicForm: PublicIntakeFormOrchestrator,
    private readonly submission: IntakeSubmissionOrchestrator,
    private readonly answers: IntakeAnswersOrchestrator,
  ) {}

  createLink(
    workspaceId: string,
    clientId: string,
    namedFormId?: string | null,
  ): Promise<IntakeLinkView> {
    return this.linkCreation.execute(workspaceId, clientId, namedFormId);
  }

  openForm(token: string): Promise<PublicIntakeView> {
    return this.publicForm.execute(token);
  }

  submit(
    token: string,
    answers: unknown,
    consents: ClientConsentsDto,
  ): Promise<{ submittedAt: Date }> {
    return this.submission.execute(token, answers, consents);
  }

  latestAnswers(
    workspaceId: string,
    clientId: string,
  ): Promise<IntakeResponseView> {
    return this.answers.execute(workspaceId, clientId);
  }
}
