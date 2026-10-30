import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PaymentChannelsQueryHandler } from '../handlers/payment-channels-query.handler';
import type {
  NewPaymentChannel,
  PaymentChannelRecord,
} from '../interfaces/payment-channel.interface';

/** Takes over `PaymentChannelsService.create`. */
@Injectable()
export class PaymentChannelCreationOrchestrator {
  constructor(
    private readonly channelsQuery: PaymentChannelsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    workspaceId: string,
    channel: NewPaymentChannel,
  ): Promise<PaymentChannelRecord> {
    return this.transactions.run(
      () => this.channelsQuery.create(workspaceId, channel),
      { workspaceId },
    );
  }
}
