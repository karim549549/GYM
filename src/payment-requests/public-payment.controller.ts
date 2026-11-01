import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from '../common/decorators/public.decorator';
import {
  ImageUploadPipe,
  type UploadedFile as Upload,
} from '../common/pipes/image-upload.pipe';
import { PaymentTokenParamsDto } from './dto/payment-token-params.dto';
import { ReportPaymentDto } from './dto/report-payment.dto';
import type { PublicPaymentRequestView } from './interfaces/payment-request.interface';
import { PaymentRequestsService } from './payment-requests.service';

// A screenshot of a transfer: the app already shrinks it, so 6 MB is generous. The upload parser stops reading at this size.
const RECEIPT_MAX_BYTES = 6 * 1024 * 1024;

/**
 * What a client does from a payment link. Nobody is signed in: the address only finds the request, and
 * all it lets them do is read what is asked and say they paid, with the screenshot. Open (`@Public`) for that reason, and
 * nothing wider may be given to these routes.
 */
@Public()
@Controller('pay')
export class PublicPaymentController {
  constructor(private readonly paymentRequests: PaymentRequestsService) {}

  @Get(':token')
  open(
    @Param() params: PaymentTokenParamsDto,
  ): Promise<PublicPaymentRequestView> {
    return this.paymentRequests.open(params.token);
  }

  /** The client says they paid. A multipart form: the `method` field and the transfer screenshot as the `file` field, which is required. */
  @Post(':token/report')
  @HttpCode(204)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: RECEIPT_MAX_BYTES, files: 1 },
    }),
  )
  report(
    @Param() params: PaymentTokenParamsDto,
    @Body() dto: ReportPaymentDto,
    @UploadedFile(new ImageUploadPipe({ maxBytes: RECEIPT_MAX_BYTES }))
    file: Upload,
  ): Promise<void> {
    return this.paymentRequests.report(params.token, dto.method, file.buffer);
  }
}
