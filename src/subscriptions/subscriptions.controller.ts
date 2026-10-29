import { RequireAction } from '../common/decorators/require-action.decorator';
import { WorkspaceAction } from '../members/enums/workspace-action.enum';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentPrincipal } from '../common/decorators/current-principal.decorator';
import { CurrentWorkspaceId } from '../common/decorators/current-workspace-id.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { PaginatedResponse } from '../common/handlers/base-query.handler';
import type { Principal } from '../auth/interfaces/principal.interface';
import type { PaymentRecord } from '../payments/interfaces/payment.interface';
import { FreezeSubscriptionDto } from './dto/freeze-subscription.dto';
import { ListSubscriptionsQueryDto } from './dto/list-subscriptions.query.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { ResumeSubscriptionDto } from './dto/resume-subscription.dto';
import { SubscriptionParamsDto } from './dto/subscription-params.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import type {
  FreezeRecord,
  SubscriptionRecord,
} from './interfaces/subscription.interface';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @RequireAction(WorkspaceAction.SUBSCRIPTIONS_READ)
  @Get()
  list(
    @CurrentWorkspaceId() workspaceId: string,
    @Query() query: ListSubscriptionsQueryDto,
  ): Promise<PaginatedResponse<SubscriptionRecord>> {
    const { page, limit, ...filter } = query;
    return this.subscriptions.list(workspaceId, filter, page, limit);
  }

  @RequireAction(WorkspaceAction.SUBSCRIPTIONS_READ)
  @Get(':id')
  findOne(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: SubscriptionParamsDto,
  ): Promise<SubscriptionRecord> {
    return this.subscriptions.findOne(workspaceId, params.id);
  }

  @RequireAction(WorkspaceAction.SUBSCRIPTIONS_WRITE)
  @Patch(':id')
  changeEnd(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: SubscriptionParamsDto,
    @Body() dto: UpdateSubscriptionDto,
  ): Promise<SubscriptionRecord> {
    return this.subscriptions.changeEnd(workspaceId, params.id, dto.endsOn);
  }

  @RequireAction(WorkspaceAction.SUBSCRIPTIONS_WRITE)
  @Post(':id/freeze')
  freeze(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: SubscriptionParamsDto,
    @Body() dto: FreezeSubscriptionDto,
  ): Promise<SubscriptionRecord> {
    return this.subscriptions.freeze(workspaceId, params.id, dto);
  }

  @RequireAction(WorkspaceAction.SUBSCRIPTIONS_WRITE)
  @Post(':id/resume')
  resume(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: SubscriptionParamsDto,
    @Body() dto: ResumeSubscriptionDto,
  ): Promise<SubscriptionRecord> {
    return this.subscriptions.resume(workspaceId, params.id, dto.resumedOn);
  }

  @RequireAction(WorkspaceAction.SUBSCRIPTIONS_WRITE)
  @Post(':id/cancel')
  cancel(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: SubscriptionParamsDto,
  ): Promise<SubscriptionRecord> {
    return this.subscriptions.cancel(workspaceId, params.id);
  }

  @RequireAction(WorkspaceAction.SUBSCRIPTIONS_READ)
  @Get(':id/freezes')
  freezes(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: SubscriptionParamsDto,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponse<FreezeRecord>> {
    return this.subscriptions.freezes(
      workspaceId,
      params.id,
      query.page,
      query.limit,
    );
  }

  @RequireAction(WorkspaceAction.PAYMENTS_WRITE)
  @Post(':id/payments')
  receivePayment(
    @CurrentWorkspaceId() workspaceId: string,
    @CurrentPrincipal() principal: Principal,
    @Param() params: SubscriptionParamsDto,
    @Body() dto: RecordPaymentDto,
  ): Promise<PaymentRecord> {
    return this.subscriptions.receivePayment(
      workspaceId,
      principal.personId,
      params.id,
      dto,
    );
  }
}
