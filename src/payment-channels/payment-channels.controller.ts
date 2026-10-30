import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentWorkspaceId } from '../common/decorators/current-workspace-id.decorator';
import { RequireAction } from '../common/decorators/require-action.decorator';
import { WorkspaceAction } from '../members/enums/workspace-action.enum';
import { CreatePaymentChannelDto } from './dto/create-payment-channel.dto';
import { PaymentChannelParamsDto } from './dto/payment-channel-params.dto';
import { UpdatePaymentChannelDto } from './dto/update-payment-channel.dto';
import type { PaymentChannelRecord } from './interfaces/payment-channel.interface';
import { PaymentChannelsService } from './payment-channels.service';

@Controller('payment-channels')
export class PaymentChannelsController {
  constructor(private readonly channels: PaymentChannelsService) {}

  @RequireAction(WorkspaceAction.MEMBER)
  @Get()
  list(
    @CurrentWorkspaceId() workspaceId: string,
  ): Promise<PaymentChannelRecord[]> {
    return this.channels.list(workspaceId);
  }

  @RequireAction(WorkspaceAction.WORKSPACE_SETTINGS)
  @Post()
  create(
    @CurrentWorkspaceId() workspaceId: string,
    @Body() dto: CreatePaymentChannelDto,
  ): Promise<PaymentChannelRecord> {
    return this.channels.create(workspaceId, dto);
  }

  @RequireAction(WorkspaceAction.WORKSPACE_SETTINGS)
  @Patch(':id')
  update(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: PaymentChannelParamsDto,
    @Body() dto: UpdatePaymentChannelDto,
  ): Promise<PaymentChannelRecord> {
    return this.channels.update(workspaceId, params.id, dto);
  }

  @RequireAction(WorkspaceAction.WORKSPACE_SETTINGS)
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: PaymentChannelParamsDto,
  ): Promise<void> {
    return this.channels.remove(workspaceId, params.id);
  }
}
