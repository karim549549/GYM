import { Injectable } from '@nestjs/common';
import { CheckinsService } from '../../checkins/checkins.service';
import { TransactionManager } from '../../database/transaction.manager';
import { PaymentsService } from '../../payments/payments.service';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import type { BusinessAnalytics } from '../interfaces/analytics.interface';
import { BusinessAnalyticsPolicy } from '../policies/business-analytics.policy';

/**
 * Takes over `AnalyticsService.business`: what keeps the coach subscribed, their work seen as a
 * business for the first time. It owns no data: revenue comes from the payments, head counts, renewals
 * and how long clients stay from the subscriptions, and who is at risk from the check-ins. One
 * transaction, so the numbers are of one moment.
 *
 * The head count of a past month is the clients whose subscription covered its last day. A
 * subscription cancelled part way is not counted at all, because only its status is kept, not when it
 * was cancelled: so the past is slightly understated for coaches who cancel often.
 */
@Injectable()
export class BusinessAnalyticsOrchestrator {
  private static readonly MONTHS = 6;
  private static readonly RENEWAL_WINDOW_DAYS = 90;

  constructor(
    private readonly payments: PaymentsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly checkins: CheckinsService,
    private readonly dates: SubscriptionDatesPolicy,
    private readonly analyticsPolicy: BusinessAnalyticsPolicy,
    private readonly transactions: TransactionManager,
  ) {}

  execute(workspaceId: string): Promise<BusinessAnalytics> {
    const today = this.dates.today(new Date());
    const months = this.analyticsPolicy.lastMonths(
      today,
      BusinessAnalyticsOrchestrator.MONTHS,
    );

    return this.transactions.run(
      async () => {
        const revenue = await this.payments.revenueByMonth(
          workspaceId,
          months[0].from,
          months[months.length - 1].to,
        );
        const statistics = await this.subscriptions.statistics(workspaceId, {
          coveredOn: months.map((m) =>
            this.analyticsPolicy.measuringDay(m, today),
          ),
          endedFrom: this.dates.addDays(
            today,
            -BusinessAnalyticsOrchestrator.RENEWAL_WINDOW_DAYS,
          ),
          endedTo: this.dates.addDays(today, -1),
          today,
        });
        const quiet = await this.checkins.atRisk(workspaceId, 1, 1);

        const received = new Map(
          revenue.months.map((m) => [m.month, m.totalMinor]),
        );
        const total = revenue.months.reduce((sum, m) => sum + m.totalMinor, 0);

        return {
          revenue: months.map((m) => ({
            month: m.month,
            totalMinor: received.get(m.month) ?? 0,
          })),
          activeClients: months.map((m, index) => ({
            month: m.month,
            activeClients: statistics.coveredOn[index].clients,
          })),
          renewalRatePct: this.analyticsPolicy.percent(
            statistics.renewals.renewed,
            statistics.renewals.ended,
          ),
          averageClientLifetimeDays: this.analyticsPolicy.average(
            statistics.lifetime.totalDays,
            statistics.lifetime.clients,
          ),
          averageRevenuePerClientMinor: this.analyticsPolicy.average(
            total,
            revenue.payers,
          ),
          atRiskClients: quiet.total,
        };
      },
      { workspaceId },
    );
  }
}
