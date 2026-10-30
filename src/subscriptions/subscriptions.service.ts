import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../common/handlers/base-query.handler';
import type { PaymentRecord } from '../payments/interfaces/payment.interface';
import type {
  FreezeRecord,
  LiveSubscription,
  SubscriptionListFilter,
  SubscriptionRecord,
  SubscriptionSale,
  SubscriptionStatistics,
  SubscriptionSummary,
} from './interfaces/subscription.interface';
import { SubscriptionCancellationOrchestrator } from './orchestration/subscription-cancellation.orchestrator';
import { SubscriptionCreationOrchestrator } from './orchestration/subscription-creation.orchestrator';
import { SubscriptionDetailsOrchestrator } from './orchestration/subscription-details.orchestrator';
import { SubscriptionFreezeListOrchestrator } from './orchestration/subscription-freeze-list.orchestrator';
import { SubscriptionFreezeOrchestrator } from './orchestration/subscription-freeze.orchestrator';
import { SubscriptionListOrchestrator } from './orchestration/subscription-list.orchestrator';
import { SubscriptionLiveOrchestrator } from './orchestration/subscription-live.orchestrator';
import {
  type PaymentReceived,
  SubscriptionPaymentOrchestrator,
} from './orchestration/subscription-payment.orchestrator';
import { SubscriptionResumeOrchestrator } from './orchestration/subscription-resume.orchestrator';
import { SubscriptionFirstStartOrchestrator } from './orchestration/subscription-first-start.orchestrator';
import { SubscriptionStatisticsOrchestrator } from './orchestration/subscription-statistics.orchestrator';
import { SubscriptionSummaryOrchestrator } from './orchestration/subscription-summary.orchestrator';
import { SubscriptionUpdateOrchestrator } from './orchestration/subscription-update.orchestrator';

/** The subscriptions module's interface: what a client has bought, and the money against it. */
@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly creation: SubscriptionCreationOrchestrator,
    private readonly listing: SubscriptionListOrchestrator,
    private readonly details: SubscriptionDetailsOrchestrator,
    private readonly update: SubscriptionUpdateOrchestrator,
    private readonly freezing: SubscriptionFreezeOrchestrator,
    private readonly resuming: SubscriptionResumeOrchestrator,
    private readonly cancellation: SubscriptionCancellationOrchestrator,
    private readonly freezeList: SubscriptionFreezeListOrchestrator,
    private readonly payment: SubscriptionPaymentOrchestrator,
    private readonly summarizing: SubscriptionSummaryOrchestrator,
    private readonly statisticsOrchestrator: SubscriptionStatisticsOrchestrator,
    private readonly firstStartOrchestrator: SubscriptionFirstStartOrchestrator,
    private readonly liveOrchestrator: SubscriptionLiveOrchestrator,
  ) {}

  /** The running subscription of each of these clients, for the clients list. */
  liveFor(workspaceId: string, clientIds: string[]): Promise<LiveSubscription[]> {
    return this.liveOrchestrator.execute(workspaceId, clientIds);
  }

  sell(
    workspaceId: string,
    clientId: string,
    sale: SubscriptionSale,
  ): Promise<SubscriptionRecord> {
    return this.creation.execute(workspaceId, clientId, sale);
  }

  list(
    workspaceId: string,
    filter: SubscriptionListFilter,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<SubscriptionRecord>> {
    return this.listing.execute(workspaceId, filter, page, limit);
  }

  findOne(
    workspaceId: string,
    subscriptionId: string,
  ): Promise<SubscriptionRecord> {
    return this.details.execute(workspaceId, subscriptionId);
  }

  changeEnd(
    workspaceId: string,
    subscriptionId: string,
    endsOn: string,
  ): Promise<SubscriptionRecord> {
    return this.update.execute(workspaceId, subscriptionId, endsOn);
  }

  freeze(
    workspaceId: string,
    subscriptionId: string,
    freeze: { frozenOn?: string; reason?: string },
  ): Promise<SubscriptionRecord> {
    return this.freezing.execute(workspaceId, subscriptionId, freeze);
  }

  resume(
    workspaceId: string,
    subscriptionId: string,
    resumedOn?: string,
  ): Promise<SubscriptionRecord> {
    return this.resuming.execute(workspaceId, subscriptionId, resumedOn);
  }

  cancel(
    workspaceId: string,
    subscriptionId: string,
  ): Promise<SubscriptionRecord> {
    return this.cancellation.execute(workspaceId, subscriptionId);
  }

  freezes(
    workspaceId: string,
    subscriptionId: string,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<FreezeRecord>> {
    return this.freezeList.execute(workspaceId, subscriptionId, page, limit);
  }

  receivePayment(
    workspaceId: string,
    recordedBy: string,
    subscriptionId: string,
    received: PaymentReceived,
  ): Promise<PaymentRecord> {
    return this.payment.execute(
      workspaceId,
      recordedBy,
      subscriptionId,
      received,
    );
  }

  /** For the coach's business analytics: head counts, renewals and how long clients stay. */
  statistics(
    workspaceId: string,
    input: {
      coveredOn: string[];
      endedFrom: string;
      endedTo: string;
      today: string;
    },
  ): Promise<SubscriptionStatistics> {
    return this.statisticsOrchestrator.execute(workspaceId, input);
  }

  /** The day a client's first subscription began, for the weeks they have completed. */
  firstStart(workspaceId: string, clientId: string): Promise<string | null> {
    return this.firstStartOrchestrator.execute(workspaceId, clientId);
  }

  summary(workspaceId: string): Promise<SubscriptionSummary> {
    return this.summarizing.execute(workspaceId);
  }
}
