import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { ConsentsService } from '../../consents/consents.service';
import { ClientConsentType } from '../../consents/enums/client-consent-type.enum';
import { TransactionManager } from '../../database/transaction.manager';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { CheckinsQueryHandler } from '../handlers/checkins-query.handler';
import type {
  CheckinRecord,
  StoredCheckin,
} from '../interfaces/checkin.interface';
import { CheckinStatePolicy } from '../policies/checkin-state.policy';

/**
 * What every flow that hands a check-in back to a coach shares: the status worked out from today's
 * date, and the link built from the secret, which the coach gets as an address and never as a token.
 */
export abstract class BaseCheckinOrchestrator {
  constructor(
    protected readonly checkinsQuery: CheckinsQueryHandler,
    protected readonly config: ConfigService<Env, true>,
    protected readonly dates: SubscriptionDatesPolicy,
    protected readonly statePolicy: CheckinStatePolicy,
    protected readonly transactions: TransactionManager,
  ) {}

  protected linkFor(token: string): string {
    return `${this.config.get('PUBLIC_APP_URL', { infer: true })}/c/${token}`;
  }

  protected present(row: StoredCheckin, today: string): CheckinRecord {
    const { token, ...rest } = row;
    return {
      ...rest,
      answersHidden: false,
      link: this.linkFor(token),
      status: this.statePolicy.statusOf({
        dueOn: row.dueOn,
        submittedAt: row.submittedAt,
        today,
      }),
    };
  }

  /** Takes the answers out of what a client no longer lets the coach read; the check-in itself stays. */
  protected async withVisibleAnswers(
    consents: ConsentsService,
    workspaceId: string,
    records: CheckinRecord[],
  ): Promise<CheckinRecord[]> {
    const allowed = await [...new Set(records.map((r) => r.clientId))].reduce(
      async (pending, clientId) => {
        const permissions = await pending;
        permissions.set(
          clientId,
          await consents.isGranted(workspaceId, clientId, [
            ClientConsentType.DATA_PROCESSING,
            ClientConsentType.HEALTH_DATA,
          ]),
        );
        return permissions;
      },
      Promise.resolve(new Map<string, boolean>()),
    );
    return records.map((record) =>
      allowed.get(record.clientId)
        ? record
        : { ...record, answers: null, answersHidden: true },
    );
  }
}
