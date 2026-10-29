import { Injectable } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import { TransactionManager } from '../../database/transaction.manager';
import { RemindersService } from '../../reminders/reminders.service';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { CheckinScheduleNotFoundException } from '../exceptions/checkin-exceptions';
import { CheckinsQueryHandler } from '../handlers/checkins-query.handler';

/**
 * Takes over `CheckinsService.stopSchedule`. The schedule stays, switched off, so turning it on
 * again keeps its settings; the coming check-ins nobody answered are dropped with their links.
 */
@Injectable()
export class CheckinScheduleStoppingOrchestrator {
  constructor(
    private readonly checkinsQuery: CheckinsQueryHandler,
    private readonly clients: ClientsService,
    private readonly reminders: RemindersService,
    private readonly dates: SubscriptionDatesPolicy,
    private readonly transactions: TransactionManager,
  ) {}

  execute(workspaceId: string, clientId: string): Promise<void> {
    return this.transactions.run(
      async () => {
        await this.clients.findOne(workspaceId, clientId);
        if (!(await this.checkinsQuery.deactivateSchedule(clientId))) {
          throw new CheckinScheduleNotFoundException();
        }
        const dropped = await this.checkinsQuery.deleteOpenAfter(
          clientId,
          this.dates.today(new Date()),
        );
        await this.reminders.cancelCheckins(workspaceId, dropped);
      },
      { workspaceId },
    );
  }
}
