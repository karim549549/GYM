import { RequireAction } from '../common/decorators/require-action.decorator';
import { WorkspaceAction } from '../members/enums/workspace-action.enum';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentWorkspaceId } from '../common/decorators/current-workspace-id.decorator';
import type { PaginatedResponse } from '../common/handlers/base-query.handler';
import { BillingService } from './billing.service';
import { ChangePlanDto } from './dto/change-plan.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices.query.dto';
import type {
  BillingOverview,
  InvoiceRecord,
  PlatformPlanRecord,
} from './interfaces/billing.interface';

/** What a coach sees and does about their own plan with the platform. */
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @RequireAction(WorkspaceAction.MEMBER)
  @Get('plans')
  plans(): Promise<PlatformPlanRecord[]> {
    return this.billing.plans();
  }

  @RequireAction(WorkspaceAction.BILLING)
  @Get('subscription')
  overview(
    @CurrentWorkspaceId() workspaceId: string,
  ): Promise<BillingOverview> {
    return this.billing.overview(workspaceId);
  }

  @RequireAction(WorkspaceAction.BILLING)
  @Post('subscription/change')
  changePlan(
    @CurrentWorkspaceId() workspaceId: string,
    @Body() dto: ChangePlanDto,
  ): Promise<BillingOverview> {
    return this.billing.changePlan(workspaceId, dto.planId);
  }

  @RequireAction(WorkspaceAction.BILLING)
  @Get('invoices')
  invoices(
    @CurrentWorkspaceId() workspaceId: string,
    @Query() query: ListInvoicesQueryDto,
  ): Promise<PaginatedResponse<InvoiceRecord>> {
    return this.billing.invoices(
      workspaceId,
      query.status,
      query.page,
      query.limit,
    );
  }
}
