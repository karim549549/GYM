import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { Principal } from '../auth/interfaces/principal.interface';
import { CurrentPrincipal } from '../common/decorators/current-principal.decorator';
import { CurrentWorkspaceId } from '../common/decorators/current-workspace-id.decorator';
import { RequireAction } from '../common/decorators/require-action.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { PaginatedResponse } from '../common/handlers/base-query.handler';
import { WorkspaceAction } from '../members/enums/workspace-action.enum';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { PaymentRequestParamsDto } from './dto/payment-request-params.dto';
import type { PaymentRequestRecord } from './interfaces/payment-request.interface';
import type { PaymentRequestConfirmed } from './orchestration/payment-request-confirmation.orchestrator';
import { PaymentRequestsService } from './payment-requests.service';

/** The coach's side: make a payment link for a subscription and see the ones sent. */
@Controller('payment-requests')
export class PaymentRequestsController {
  constructor(private readonly paymentRequests: PaymentRequestsService) {}

  @RequireAction(WorkspaceAction.PAYMENTS_WRITE)
  @Post()
  create(
    @CurrentWorkspaceId() workspaceId: string,
    @CurrentPrincipal() principal: Principal,
    @Body() dto: CreatePaymentRequestDto,
  ): Promise<PaymentRequestRecord> {
    return this.paymentRequests.create(workspaceId, principal.personId, dto);
  }

  @RequireAction(WorkspaceAction.PAYMENTS_READ)
  @Get()
  list(
    @CurrentWorkspaceId() workspaceId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponse<PaymentRequestRecord>> {
    return this.paymentRequests.list(workspaceId, query.page, query.limit);
  }

  /** Accepts what the client reported and records the payment, with their screenshot. */
  @RequireAction(WorkspaceAction.PAYMENTS_WRITE)
  @Post(':id/confirm')
  confirm(
    @CurrentWorkspaceId() workspaceId: string,
    @CurrentPrincipal() principal: Principal,
    @Param() params: PaymentRequestParamsDto,
  ): Promise<PaymentRequestConfirmed> {
    return this.paymentRequests.confirm(
      workspaceId,
      principal.personId,
      params.id,
    );
  }
}
