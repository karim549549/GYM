import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../common/handlers/base-query.handler';
import type { PaymentMethod } from '../payments/enums/payment-method.enum';
import type {
  PaymentRequestRecord,
  PublicPaymentRequestView,
} from './interfaces/payment-request.interface';
import {
  PaymentRequestCreationOrchestrator,
  type PaymentRequestAsked,
} from './orchestration/payment-request-creation.orchestrator';
import {
  PaymentRequestConfirmationOrchestrator,
  type PaymentRequestConfirmed,
} from './orchestration/payment-request-confirmation.orchestrator';
import { PaymentRequestListOrchestrator } from './orchestration/payment-request-list.orchestrator';
import { PaymentRequestReportingOrchestrator } from './orchestration/payment-request-reporting.orchestrator';
import { PublicPaymentRequestOrchestrator } from './orchestration/public-payment-request.orchestrator';

/** The payment requests module's interface: the links a coach sends to be paid, and what the client does with one. */
@Injectable()
export class PaymentRequestsService {
  constructor(
    private readonly creation: PaymentRequestCreationOrchestrator,
    private readonly listing: PaymentRequestListOrchestrator,
    private readonly publicView: PublicPaymentRequestOrchestrator,
    private readonly reporting: PaymentRequestReportingOrchestrator,
    private readonly confirmation: PaymentRequestConfirmationOrchestrator,
  ) {}

  create(
    workspaceId: string,
    createdBy: string,
    asked: PaymentRequestAsked,
  ): Promise<PaymentRequestRecord> {
    return this.creation.execute(workspaceId, createdBy, asked);
  }

  list(
    workspaceId: string,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<PaymentRequestRecord>> {
    return this.listing.execute(workspaceId, page, limit);
  }

  open(token: string): Promise<PublicPaymentRequestView> {
    return this.publicView.execute(token);
  }

  report(
    token: string,
    method: PaymentMethod,
    receipt: Uint8Array,
  ): Promise<void> {
    return this.reporting.execute(token, method, receipt);
  }

  /** The coach accepts what the client reported: that records the payment. */
  confirm(
    workspaceId: string,
    recordedBy: string,
    requestId: string,
  ): Promise<PaymentRequestConfirmed> {
    return this.confirmation.execute(workspaceId, recordedBy, requestId);
  }
}
