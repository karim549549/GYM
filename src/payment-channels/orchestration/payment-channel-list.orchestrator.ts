import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PaymentChannelsQueryHandler } from '../handlers/payment-channels-query.handler';
import type { PaymentChannelRecord } from '../interfaces/payment-channel.interface';

/** Takes over `PaymentChannelsService.list`: the ways to pay of the workspace the coach acts in. */
@Injectable()
export class PaymentChannelListOrchestrator {
  constructor(
    private readonly channelsQuery: PaymentChannelsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(workspaceId: string): Promise<PaymentChannelRecord[]> {
    return this.transactions.run(() => this.channelsQuery.list(), {
      workspaceId,
    });
  }
}
