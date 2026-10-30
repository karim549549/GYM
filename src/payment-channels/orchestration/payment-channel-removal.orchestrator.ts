import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PaymentChannelNotFoundException } from '../exceptions/payment-channel-exceptions';
import { PaymentChannelsQueryHandler } from '../handlers/payment-channels-query.handler';

/** Takes over `PaymentChannelsService.remove`. Nothing else points at a payment method, so it is deleted. */
@Injectable()
export class PaymentChannelRemovalOrchestrator {
  constructor(
    private readonly channelsQuery: PaymentChannelsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(workspaceId: string, channelId: string): Promise<void> {
    const removed = await this.transactions.run(
      () => this.channelsQuery.remove(channelId),
      { workspaceId },
    );
    if (!removed) {
      throw new PaymentChannelNotFoundException();
    }
  }
}
