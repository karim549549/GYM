import { RequireAction } from '../common/decorators/require-action.decorator';
import { WorkspaceAction } from '../members/enums/workspace-action.enum';
import {
  Controller,
  Get,
  Param,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentWorkspaceId } from '../common/decorators/current-workspace-id.decorator';
import type { PaginatedResponse } from '../common/handlers/base-query.handler';
import {
  ImageUploadPipe,
  type UploadedFile as Upload,
} from '../common/pipes/image-upload.pipe';
import { PaymentParamsDto } from './dto/payment-params.dto';
import { ListPaymentsQueryDto } from './dto/list-payments.query.dto';
import { PaymentSummaryQueryDto } from './dto/payment-summary.query.dto';
import type {
  PaymentRecord,
  PaymentSummary,
} from './interfaces/payment.interface';
import { PaymentsService } from './payments.service';

// A screenshot of a transfer: the app already shrinks it, so 6 MB is generous. The upload parser stops reading at this size.
const RECEIPT_MAX_BYTES = 6 * 1024 * 1024;

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

  /** Adds or replaces the transfer screenshot, as the `file` field of a multipart form. Optional for a coach. */
  @RequireAction(WorkspaceAction.PAYMENTS_WRITE)
  @Put(':id/receipt')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: RECEIPT_MAX_BYTES, files: 1 },
    }),
  )
  setReceipt(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: PaymentParamsDto,
    @UploadedFile(new ImageUploadPipe({ maxBytes: RECEIPT_MAX_BYTES }))
    file: Upload,
  ): Promise<PaymentRecord> {
    return this.payments.setReceipt(workspaceId, params.id, file.buffer);
  }
}
