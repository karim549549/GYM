import { RequireAction } from '../common/decorators/require-action.decorator';
import { WorkspaceAction } from '../members/enums/workspace-action.enum';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentWorkspaceId } from '../common/decorators/current-workspace-id.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { PaginatedResponse } from '../common/handlers/base-query.handler';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { SubscriptionParamsDto } from './dto/subscription-params.dto';
import type { SubscriptionRecord } from './interfaces/subscription.interface';
import { SubscriptionsService } from './subscriptions.service';

/** What a coach does with one client's subscriptions. */
@Controller('clients/:id/subscriptions')
export class ClientSubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @RequireAction(WorkspaceAction.SUBSCRIPTIONS_WRITE)
  @Post()
  sell(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: SubscriptionParamsDto,
    @Body() dto: CreateSubscriptionDto,
  ): Promise<SubscriptionRecord> {
    return this.subscriptions.sell(workspaceId, params.id, dto);
  }

  @RequireAction(WorkspaceAction.SUBSCRIPTIONS_READ)
  @Get()
  list(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: SubscriptionParamsDto,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponse<SubscriptionRecord>> {
    return this.subscriptions.list(
      workspaceId,
      { clientId: params.id },
      query.page,
      query.limit,
    );
  }
}
