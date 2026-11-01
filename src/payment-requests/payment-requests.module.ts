import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { PaymentChannelsModule } from '../payment-channels/payment-channels.module';
import { StorageModule } from '../storage/storage.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { PaymentRequestFileHandler } from './handlers/payment-request-file.handler';
import { PaymentRequestsQueryHandler } from './handlers/payment-requests-query.handler';
import { PaymentRequestConfirmationOrchestrator } from './orchestration/payment-request-confirmation.orchestrator';
import { PaymentRequestCreationOrchestrator } from './orchestration/payment-request-creation.orchestrator';
import { PaymentRequestListOrchestrator } from './orchestration/payment-request-list.orchestrator';
import { PaymentRequestReportingOrchestrator } from './orchestration/payment-request-reporting.orchestrator';
import { PublicPaymentRequestOrchestrator } from './orchestration/public-payment-request.orchestrator';
import { PaymentRequestsController } from './payment-requests.controller';
import { PaymentRequestsService } from './payment-requests.service';
import { PaymentRequestStatePolicy } from './policies/payment-request-state.policy';
import { PublicPaymentController } from './public-payment.controller';

@Module({
  imports: [
    ClientsModule,
    PaymentChannelsModule,
    StorageModule,
    SubscriptionsModule,
    WorkspacesModule,
  ],
  controllers: [PaymentRequestsController, PublicPaymentController],
  providers: [
    PaymentRequestsService,
    PaymentRequestsQueryHandler,
    PaymentRequestFileHandler,
    PaymentRequestCreationOrchestrator,
    PaymentRequestListOrchestrator,
    PublicPaymentRequestOrchestrator,
    PaymentRequestReportingOrchestrator,
    PaymentRequestConfirmationOrchestrator,
    PaymentRequestStatePolicy,
  ],
})
export class PaymentRequestsModule {}
