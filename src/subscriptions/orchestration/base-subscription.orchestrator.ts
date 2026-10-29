import { PaymentsService } from '../../payments/payments.service';
import { TransactionManager } from '../../database/transaction.manager';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { SubscriptionsQueryHandler } from '../handlers/subscriptions-query.handler';
import type {
  StoredSubscription,
  SubscriptionRecord,
} from '../interfaces/subscription.interface';
import { SubscriptionDatesPolicy } from '../policies/subscription-dates.policy';
import { SubscriptionStatePolicy } from '../policies/subscription-state.policy';

/**
 * What every flow that hands a subscription back to a coach shares: turning the stored row into
 * what they see. How much was paid, whether it is expiring and whether money is owed are worked
 * out here each time, from the payments, the workspace's alert window and today's date, because
 * none of them is stored. Call it inside the flow's transaction so the figures are consistent.
 */
export abstract class BaseSubscriptionOrchestrator {
  constructor(
    protected readonly subscriptionsQuery: SubscriptionsQueryHandler,
    protected readonly payments: PaymentsService,
    protected readonly workspaces: WorkspacesService,
    protected readonly dates: SubscriptionDatesPolicy,
    protected readonly statePolicy: SubscriptionStatePolicy,
    protected readonly transactions: TransactionManager,
  ) {}

  protected async present(
    workspaceId: string,
    rows: StoredSubscription[],
  ): Promise<SubscriptionRecord[]> {
    if (rows.length === 0) {
      return [];
    }
    const workspace = await this.workspaces.findCurrent(workspaceId);
    const totals = await this.payments.totalsFor(
      workspaceId,
      rows.map((row) => row.id),
    );
    const today = this.dates.today(new Date());

    return rows.map((row) => {
      const paidMinor = totals.get(row.id) ?? 0;
      const dueMinor = Math.max(row.priceMinor - paidMinor, 0);
      return {
        ...row,
        paidMinor,
        dueMinor,
        paymentStatus: this.statePolicy.paymentStatusOf({
          priceMinor: row.priceMinor,
          paidMinor,
        }).outcome,
        state: this.statePolicy.stateOf({
          status: row.status,
          endsOn: row.endsOn,
          today,
          alertDays: workspace.expiryAlertDays,
          dueMinor,
        }).outcome,
      };
    });
  }

  protected async presentOne(
    workspaceId: string,
    row: StoredSubscription,
  ): Promise<SubscriptionRecord> {
    const [record] = await this.present(workspaceId, [row]);
    return record;
  }
}
