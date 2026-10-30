import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../../common/handlers/base-query.handler';
import { TransactionManager } from '../../database/transaction.manager';
import { CheckinsQueryHandler } from '../handlers/checkins-query.handler';
import type { ClientCheckinSchedule } from '../interfaces/checkin.interface';

/** Takes over `CheckinsService.listSchedules`: how every client of the workspace is asked to check in. */
@Injectable()
export class CheckinScheduleListOrchestrator {
  constructor(
    private readonly checkinsQuery: CheckinsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    workspaceId: string,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<ClientCheckinSchedule>> {
    return this.transactions.run(
      () => this.checkinsQuery.listSchedules(page, limit),
      { workspaceId },
    );
  }
}
