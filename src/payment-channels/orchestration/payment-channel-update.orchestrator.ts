import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PaymentChannelNotFoundException } from '../exceptions/payment-channel-exceptions';
import { PaymentChannelsQueryHandler } from '../handlers/payment-channels-query.handler';
import type {
  PaymentChannelChanges,
  PaymentChannelRecord,
} from '../interfaces/payment-channel.interface';

/** Takes over `PaymentChannelsService.update`: change what was sent, leave the rest. */
@Injectable()
export class PaymentChannelUpdateOrchestrator {
  constructor(
    private readonly channelsQuery: PaymentChannelsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(
    workspaceId: string,
    channelId: string,
    changes: PaymentChannelChanges,
  ): Promise<PaymentChannelRecord> {
    const updated = await this.transactions.run(
      () => this.channelsQuery.update(channelId, changes),
      { workspaceId },
    );
    if (!updated) {
      throw new PaymentChannelNotFoundException();
    }
    return updated;
  }
}
