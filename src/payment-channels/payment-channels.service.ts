import { Injectable } from '@nestjs/common';
import type {
  NewPaymentChannel,
  PaymentChannelChanges,
  PaymentChannelRecord,
} from './interfaces/payment-channel.interface';
import { PaymentChannelCreationOrchestrator } from './orchestration/payment-channel-creation.orchestrator';
import { PaymentChannelListOrchestrator } from './orchestration/payment-channel-list.orchestrator';
import { PaymentChannelRemovalOrchestrator } from './orchestration/payment-channel-removal.orchestrator';
import { PaymentChannelUpdateOrchestrator } from './orchestration/payment-channel-update.orchestrator';

/** The payment-channels module's interface: where a coach's clients can send money. */
@Injectable()
export class PaymentChannelsService {
  constructor(
    private readonly channelList: PaymentChannelListOrchestrator,
    private readonly channelCreation: PaymentChannelCreationOrchestrator,
    private readonly channelUpdate: PaymentChannelUpdateOrchestrator,
    private readonly channelRemoval: PaymentChannelRemovalOrchestrator,
  ) {}

  list(workspaceId: string): Promise<PaymentChannelRecord[]> {
    return this.channelList.execute(workspaceId);
  }

  create(
    workspaceId: string,
    channel: NewPaymentChannel,
  ): Promise<PaymentChannelRecord> {
    return this.channelCreation.execute(workspaceId, channel);
  }

  update(
    workspaceId: string,
    channelId: string,
    changes: PaymentChannelChanges,
  ): Promise<PaymentChannelRecord> {
    return this.channelUpdate.execute(workspaceId, channelId, changes);
  }

  remove(workspaceId: string, channelId: string): Promise<void> {
    return this.channelRemoval.execute(workspaceId, channelId);
  }
}
