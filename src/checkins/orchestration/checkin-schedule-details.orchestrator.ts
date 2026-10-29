import { Injectable } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import { TransactionManager } from '../../database/transaction.manager';
import { CheckinScheduleNotFoundException } from '../exceptions/checkin-exceptions';
import { CheckinsQueryHandler } from '../handlers/checkins-query.handler';
import type { CheckinScheduleRecord } from '../interfaces/checkin.interface';

/** Takes over `CheckinsService.findSchedule`. */
@Injectable()
export class CheckinScheduleDetailsOrchestrator {
  constructor(
    private readonly checkinsQuery: CheckinsQueryHandler,
    private readonly clients: ClientsService,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    workspaceId: string,
    clientId: string,
  ): Promise<CheckinScheduleRecord> {
    return this.transactions.run(
      async () => {
        await this.clients.findOne(workspaceId, clientId);
        const found = await this.checkinsQuery.findSchedule(clientId);
        if (!found) {
          throw new CheckinScheduleNotFoundException();
        }
        const { id: _scheduleId, ...record } = found;
        return record;
      },
      { workspaceId },
    );
  }
}
