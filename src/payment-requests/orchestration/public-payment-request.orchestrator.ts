import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PaymentChannelsService } from '../../payment-channels/payment-channels.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { PaymentRequestsQueryHandler } from '../handlers/payment-requests-query.handler';
import type { PublicPaymentRequestView } from '../interfaces/payment-request.interface';
import { PaymentRequestStatePolicy } from '../policies/payment-request-state.policy';
import { BasePaymentRequestOrchestrator } from './base-payment-request.orchestrator';

/**
 * Takes over `PaymentRequestsService.open`: what anyone with the address sees. The brand of the coach and
 * what is asked, in any state: a paid or expired link says so instead of being a dead end.
 */
@Injectable()
export class PublicPaymentRequestOrchestrator extends BasePaymentRequestOrchestrator {
  constructor(
    paymentRequests: PaymentRequestsQueryHandler,
    statePolicy: PaymentRequestStatePolicy,
    transactions: TransactionManager,
    private readonly workspaces: WorkspacesService,
    private readonly channels: PaymentChannelsService,
  ) {
    super(paymentRequests, statePolicy, transactions);
  }

  async execute(token: string): Promise<PublicPaymentRequestView> {
    const request = await this.openRequest(token);
    const { workspace, channels } = await this.transactions.run(
      async () => ({
        workspace: await this.workspaces.findCurrent(request.workspaceId),
        channels: await this.channels.list(request.workspaceId),
      }),
      { workspaceId: request.workspaceId },
    );
    return {
      coach: { brandName: workspace.brandName, logoUrl: workspace.logoUrl },
      channels: channels.map(({ method, account, url }) => ({
        method,
        account,
        url,
      })),
      clientName: request.clientName,
      packageName: request.packageName,
      amountMinor: request.amountMinor,
      currency: request.currency,
      note: request.note,
      expiresAt: request.expiresAt,
      state: this.statePolicy.of(request, new Date()),
      paidMethod: request.paidMethod,
    };
  }
}
