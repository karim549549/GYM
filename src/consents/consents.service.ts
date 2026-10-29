import { Injectable } from '@nestjs/common';
import type { ClientConsentType } from './enums/client-consent-type.enum';
import { ConsentSource } from './enums/consent-source.enum';
import type { PersonConsentType } from './enums/person-consent-type.enum';
import type {
  ConsentChange,
  ConsentState,
  ConsentText,
} from './interfaces/consent.interface';
import { ClientConsentCheckOrchestrator } from './orchestration/client-consent-check.orchestrator';
import { ClientConsentRecordingOrchestrator } from './orchestration/client-consent-recording.orchestrator';
import { ClientConsentRequirementOrchestrator } from './orchestration/client-consent-requirement.orchestrator';
import { ClientConsentStateOrchestrator } from './orchestration/client-consent-state.orchestrator';
import { ClientConsentSubmissionOrchestrator } from './orchestration/client-consent-submission.orchestrator';
import { ConsentTextListOrchestrator } from './orchestration/consent-text-list.orchestrator';
import { PersonConsentRecordingOrchestrator } from './orchestration/person-consent-recording.orchestrator';
import { PersonConsentStateOrchestrator } from './orchestration/person-consent-state.orchestrator';

/** The consents module's interface: what people and clients have agreed to, and what that allows. */
@Injectable()
export class ConsentsService {
  constructor(
    private readonly textList: ConsentTextListOrchestrator,
    private readonly clientState: ClientConsentStateOrchestrator,
    private readonly clientCheck: ClientConsentCheckOrchestrator,
    private readonly clientRequirement: ClientConsentRequirementOrchestrator,
    private readonly clientRecording: ClientConsentRecordingOrchestrator,
    private readonly clientSubmission: ClientConsentSubmissionOrchestrator,
    private readonly personState: PersonConsentStateOrchestrator,
    private readonly personRecording: PersonConsentRecordingOrchestrator,
  ) {}

  texts(): {
    version: string;
    client: ConsentText[];
    person: ConsentText[];
  } {
    return this.textList.execute();
  }

  clientStates(workspaceId: string, clientId: string): Promise<ConsentState[]> {
    return this.clientState.execute(workspaceId, clientId);
  }

  /** Whether the client has agreed to all of these now. Never throws. */
  isGranted(
    workspaceId: string,
    clientId: string,
    types: ClientConsentType[],
  ): Promise<boolean> {
    return this.clientCheck.execute(workspaceId, clientId, types);
  }

  /** Refuses with `CLIENT_CONSENT_REQUIRED` unless the client has agreed to all of these now. */
  require(
    workspaceId: string,
    clientId: string,
    types: ClientConsentType[],
  ): Promise<void> {
    return this.clientRequirement.execute(workspaceId, clientId, types);
  }

  /** The consents a client ticked on a form; the required ones must all be granted. */
  submitForClient(
    workspaceId: string,
    clientId: string,
    submitted: ConsentChange<ClientConsentType>[],
    source: ConsentSource,
  ): Promise<void> {
    return this.clientSubmission.execute(
      workspaceId,
      clientId,
      submitted,
      source,
    );
  }

  /** The client themselves choosing, from a link they hold. */
  recordForClient(
    workspaceId: string,
    clientId: string,
    changes: ConsentChange<ClientConsentType>[],
    source: ConsentSource,
  ): Promise<ConsentState[]> {
    return this.clientRecording.execute(workspaceId, clientId, changes, source);
  }

  /** A coach noting that a client told them they withdraw. A coach cannot give consent for a client. */
  withdrawOnBehalf(
    workspaceId: string,
    clientId: string,
    type: ClientConsentType,
  ): Promise<ConsentState[]> {
    return this.clientRecording.execute(
      workspaceId,
      clientId,
      [{ type, granted: false }],
      ConsentSource.COACH_ON_BEHALF,
    );
  }

  personStates(personId: string): Promise<ConsentState[]> {
    return this.personState.execute(personId);
  }

  recordForPerson(
    personId: string,
    changes: ConsentChange<PersonConsentType>[],
    source: ConsentSource,
  ): Promise<void> {
    return this.personRecording.execute(personId, changes, source);
  }
}
