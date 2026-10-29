import { Injectable } from '@nestjs/common';
import { CheckinsService } from '../../checkins/checkins.service';
import { ClientsService } from '../../clients/clients.service';
import { ConsentsService } from '../../consents/consents.service';
import { ClientConsentType } from '../../consents/enums/client-consent-type.enum';
import { TransactionManager } from '../../database/transaction.manager';
import { MeasurementsService } from '../../measurements/measurements.service';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import type {
  ClientProgress,
  MetricSeries,
} from '../interfaces/analytics.interface';
import { ClientProgressPolicy } from '../policies/client-progress.policy';

/**
 * Takes over `AnalyticsService.clientProgress`: the page coach and client both see, to make the client
 * feel progress so they renew. It owns no data: it reads the measurements, the check-ins and the
 * subscriptions through their modules and has the policy do the arithmetic. All in one transaction, so
 * the numbers are of one moment.
 */
@Injectable()
export class ClientProgressOrchestrator {
  private static readonly WINDOW_DAYS = 28;
  private static readonly WEIGHT = 'weight';
  private static readonly TARGET_WEIGHT = 'target_weight';

  constructor(
    private readonly clients: ClientsService,
    private readonly consents: ConsentsService,
    private readonly measurements: MeasurementsService,
    private readonly checkins: CheckinsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly dates: SubscriptionDatesPolicy,
    private readonly progressPolicy: ClientProgressPolicy,
    private readonly transactions: TransactionManager,
  ) {}

  execute(workspaceId: string, clientId: string): Promise<ClientProgress> {
    const today = this.dates.today(new Date());
    return this.transactions.run(
      async () => {
        await this.clients.findOne(workspaceId, clientId);
        // body measurements and check-in answers are health data: only while the client agrees
        await this.consents.require(workspaceId, clientId, [
          ClientConsentType.DATA_PROCESSING,
          ClientConsentType.HEALTH_DATA,
        ]);

        const points = await this.measurements.seriesOf(workspaceId, clientId);
        const activity = await this.checkins.activity(
          workspaceId,
          clientId,
          this.dates.addDays(today, -ClientProgressOrchestrator.WINDOW_DAYS),
          today,
        );
        const firstStart = await this.subscriptions.firstStart(
          workspaceId,
          clientId,
        );

        const weights = points.filter(
          (p) => p.metric === ClientProgressOrchestrator.WEIGHT,
        );
        const target = points
          .filter((p) => p.metric === ClientProgressOrchestrator.TARGET_WEIGHT)
          .pop();

        return {
          weight: this.progressPolicy.weight(
            weights[weights.length - 1]?.unit ?? null,
            weights.map(({ date, value }) => ({ date, value })),
            target?.value ?? null,
            today,
          ),
          measurements: this.otherSeries(points),
          adherence: this.progressPolicy.adherence(activity.window),
          weeksCompleted: this.progressPolicy.weeksCompleted(firstStart, today),
          lastCheckinAt: activity.lastSubmittedAt,
        };
      },
      { workspaceId },
    );
  }

  /** Each of the other measurements as a chart of its own, by name. */
  private otherSeries(
    points: { metric: string; unit: string; value: number; date: string }[],
  ): MetricSeries[] {
    const series = new Map<string, MetricSeries>();
    for (const point of points) {
      if (
        point.metric === ClientProgressOrchestrator.WEIGHT ||
        point.metric === ClientProgressOrchestrator.TARGET_WEIGHT
      ) {
        continue;
      }
      const chart = series.get(point.metric) ?? {
        metric: point.metric,
        unit: point.unit,
        points: [],
      };
      chart.points.push({ date: point.date, value: point.value });
      chart.unit = point.unit;
      series.set(point.metric, chart);
    }
    return [...series.values()].sort((a, b) =>
      a.metric.localeCompare(b.metric),
    );
  }
}
