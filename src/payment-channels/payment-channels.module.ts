import { Module } from '@nestjs/common';
import { PaymentChannelsQueryHandler } from './handlers/payment-channels-query.handler';
import { PaymentChannelCreationOrchestrator } from './orchestration/payment-channel-creation.orchestrator';
import { PaymentChannelListOrchestrator } from './orchestration/payment-channel-list.orchestrator';
import { PaymentChannelRemovalOrchestrator } from './orchestration/payment-channel-removal.orchestrator';
import { PaymentChannelUpdateOrchestrator } from './orchestration/payment-channel-update.orchestrator';
import { PaymentChannelsController } from './payment-channels.controller';
import { PaymentChannelsService } from './payment-channels.service';

@Module({
  controllers: [PaymentChannelsController],
  providers: [
    PaymentChannelsService,
    PaymentChannelsQueryHandler,
    PaymentChannelListOrchestrator,
    PaymentChannelCreationOrchestrator,
    PaymentChannelUpdateOrchestrator,
    PaymentChannelRemovalOrchestrator,
  ],
  exports: [PaymentChannelsService],
})
export class PaymentChannelsModule {}
