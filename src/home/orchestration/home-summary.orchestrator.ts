import { Injectable } from '@nestjs/common';
import { PaymentsService } from '../../payments/payments.service';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import type { HomeSummary } from '../interfaces/home-summary.interface';

/**
 * Takes over `HomeService.summary`. It owns no table: the subscriptions know who is active and
 * who is due, the payments know what came in, and the month both are asked about is Egypt's.
 */
@Injectable()
export class HomeSummaryOrchestrator {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly payments: PaymentsService,
  ) {}

  async execute(workspaceId: string): Promise<HomeSummary> {
    const { activeClients, renewalsDueThisWeek, month } =
      await this.subscriptions.summary(workspaceId);
    const received = await this.payments.summary(
      workspaceId,
      month.from,
      month.to,
    );
    return {
      activeClients,
      monthRevenueMinor: received.totalMinor,
      renewalsDueThisWeek,
    };
  }
}
