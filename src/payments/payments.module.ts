import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { PaymentFileHandler } from './handlers/payment-file.handler';
import { PaymentsQueryHandler } from './handlers/payments-query.handler';
import { PaymentRevenueOrchestrator } from './orchestration/payment-revenue.orchestrator';
import { PaymentListOrchestrator } from './orchestration/payment-list.orchestrator';
import { PaymentReceiptOrchestrator } from './orchestration/payment-receipt.orchestrator';
import { PaymentRecordingOrchestrator } from './orchestration/payment-recording.orchestrator';
import { PaymentSummaryOrchestrator } from './orchestration/payment-summary.orchestrator';
import { PaymentTotalsOrchestrator } from './orchestration/payment-totals.orchestrator';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [StorageModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsQueryHandler,
    PaymentFileHandler,
    PaymentReceiptOrchestrator,
    PaymentRecordingOrchestrator,
    PaymentListOrchestrator,
    PaymentSummaryOrchestrator,
    PaymentTotalsOrchestrator,
    PaymentRevenueOrchestrator,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
