import { RequireAction } from '../common/decorators/require-action.decorator';
import { WorkspaceAction } from '../members/enums/workspace-action.enum';
import { Controller, Get, Query } from '@nestjs/common';
import { CurrentWorkspaceId } from '../common/decorators/current-workspace-id.decorator';
import type { PaginatedResponse } from '../common/handlers/base-query.handler';
import { ListPaymentsQueryDto } from './dto/list-payments.query.dto';
import { PaymentSummaryQueryDto } from './dto/payment-summary.query.dto';
import type {
  PaymentRecord,
  PaymentSummary,
} from './interfaces/payment.interface';
import { PaymentsService } from './payments.service';

/** The payments screen. Recording a payment belongs to its subscription: `POST /subscriptions/:id/payments`. */
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @RequireAction(WorkspaceAction.PAYMENTS_READ)
  @Get()
  list(
    @CurrentWorkspaceId() workspaceId: string,
    @Query() query: ListPaymentsQueryDto,
  ): Promise<PaginatedResponse<PaymentRecord>> {
    const { page, limit, ...filter } = query;
    return this.payments.list(workspaceId, filter, page, limit);
  }

  @RequireAction(WorkspaceAction.PAYMENTS_READ)
  @Get('summary')
  summary(
    @CurrentWorkspaceId() workspaceId: string,
    @Query() query: PaymentSummaryQueryDto,
  ): Promise<PaymentSummary> {
    return this.payments.summary(workspaceId, query.from, query.to);
  }
}
