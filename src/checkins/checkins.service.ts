import { Injectable } from '@nestjs/common';
import type { ClientConsentType } from '../consents/enums/client-consent-type.enum';
import type { ConsentState } from '../consents/interfaces/consent.interface';
import type { PaginatedResponse } from '../common/handlers/base-query.handler';
import type {
  CheckinActivity,
  CheckinFilter,
  CheckinRecord,
  CheckinScheduleInput,
  CheckinScheduleRecord,
  ClientCheckinDays,
  ClientCheckinSchedule,
  PublicCheckinView,
  QuietClient,
} from './interfaces/checkin.interface';
import { CheckinActivityOrchestrator } from './orchestration/checkin-activity.orchestrator';
import { CheckinAtRiskOrchestrator } from './orchestration/checkin-at-risk.orchestrator';
import { CheckinDetailsOrchestrator } from './orchestration/checkin-details.orchestrator';
import { CheckinListOrchestrator } from './orchestration/checkin-list.orchestrator';
import { CheckinOverviewOrchestrator } from './orchestration/checkin-overview.orchestrator';
import { CheckinReplyOrchestrator } from './orchestration/checkin-reply.orchestrator';
import { CheckinScheduleListOrchestrator } from './orchestration/checkin-schedule-list.orchestrator';
import { CheckinScheduleDetailsOrchestrator } from './orchestration/checkin-schedule-details.orchestrator';
import { CheckinScheduleSettingOrchestrator } from './orchestration/checkin-schedule-setting.orchestrator';
import { CheckinScheduleStoppingOrchestrator } from './orchestration/checkin-schedule-stopping.orchestrator';
import { CheckinSubmissionOrchestrator } from './orchestration/checkin-submission.orchestrator';
import { CheckinTopUpOrchestrator } from './orchestration/checkin-top-up.orchestrator';
import { PublicCheckinConsentStatesOrchestrator } from './orchestration/public-checkin-consent-states.orchestrator';
import { PublicCheckinConsentsOrchestrator } from './orchestration/public-checkin-consents.orchestrator';
import { PublicCheckinFormOrchestrator } from './orchestration/public-checkin-form.orchestrator';

/** The check-ins module's interface: how a client keeps in touch with their coach after the plan. */
@Injectable()
export class CheckinsService {
  constructor(
    private readonly scheduleSetting: CheckinScheduleSettingOrchestrator,
    private readonly scheduleDetails: CheckinScheduleDetailsOrchestrator,
    private readonly scheduleStopping: CheckinScheduleStoppingOrchestrator,
    private readonly topUpOrchestrator: CheckinTopUpOrchestrator,
    private readonly listing: CheckinListOrchestrator,
    private readonly details: CheckinDetailsOrchestrator,
    private readonly replying: CheckinReplyOrchestrator,
    private readonly atRiskOrchestrator: CheckinAtRiskOrchestrator,
    private readonly overviewOrchestrator: CheckinOverviewOrchestrator,
    private readonly scheduleListing: CheckinScheduleListOrchestrator,
    private readonly publicForm: PublicCheckinFormOrchestrator,
    private readonly submission: CheckinSubmissionOrchestrator,
    private readonly activityOrchestrator: CheckinActivityOrchestrator,
    private readonly consentChange: PublicCheckinConsentsOrchestrator,
    private readonly consentStatesOrchestrator: PublicCheckinConsentStatesOrchestrator,
  ) {}

  /** The client's own choices, from the link they hold. */
  consentStates(token: string): Promise<ConsentState[]> {
    return this.consentStatesOrchestrator.execute(token);
  }

  /** The client agreeing or withdrawing, from the link they hold. */
  changeConsent(
    token: string,
    type: ClientConsentType,
    granted: boolean,
  ): Promise<ConsentState[]> {
    return this.consentChange.execute(token, type, granted);
  }

  setSchedule(
    workspaceId: string,
    clientId: string,
    input: CheckinScheduleInput,
  ): Promise<CheckinScheduleRecord> {
    return this.scheduleSetting.execute(workspaceId, clientId, input);
  }

  findSchedule(
    workspaceId: string,
    clientId: string,
  ): Promise<CheckinScheduleRecord> {
    return this.scheduleDetails.execute(workspaceId, clientId);
  }

  stopSchedule(workspaceId: string, clientId: string): Promise<void> {
    return this.scheduleStopping.execute(workspaceId, clientId);
  }

  /** For the background job: makes the check-ins that have come into the month ahead. */
  topUp(signal?: AbortSignal): Promise<number> {
    return this.topUpOrchestrator.execute(signal);
  }

  list(
    workspaceId: string,
    filter: CheckinFilter,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<CheckinRecord>> {
    return this.listing.execute(workspaceId, filter, page, limit);
  }

  findOne(workspaceId: string, checkinId: string): Promise<CheckinRecord> {
    return this.details.execute(workspaceId, checkinId);
  }

  reply(
    workspaceId: string,
    repliedBy: string,
    checkinId: string,
    text: string,
  ): Promise<CheckinRecord> {
    return this.replying.execute(workspaceId, repliedBy, checkinId, text);
  }

  /** How every client is asked to check in. */
  listSchedules(
    workspaceId: string,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<ClientCheckinSchedule>> {
    return this.scheduleListing.execute(workspaceId, page, limit);
  }

  /** For each of these clients, the days to the next check-in and the ones missed lately. */
  overviewFor(
    workspaceId: string,
    clientIds: string[],
  ): Promise<ClientCheckinDays[]> {
    return this.overviewOrchestrator.execute(workspaceId, clientIds);
  }

  atRisk(
    workspaceId: string,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<QuietClient>> {
    return this.atRiskOrchestrator.execute(workspaceId, page, limit);
  }

  /** The check-ins due in a window and what the client answered, for the progress page. */
  activity(
    workspaceId: string,
    clientId: string,
    from: string,
    to: string,
  ): Promise<{ window: CheckinActivity[]; lastSubmittedAt: Date | null }> {
    return this.activityOrchestrator.execute(workspaceId, clientId, from, to);
  }

  openForm(token: string): Promise<PublicCheckinView> {
    return this.publicForm.execute(token);
  }

  submit(token: string, answers: unknown): Promise<{ submittedAt: Date }> {
    return this.submission.execute(token, answers);
  }
}
