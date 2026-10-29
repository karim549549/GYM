import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { Principal } from '../auth/interfaces/principal.interface';
import { CurrentPrincipal } from '../common/decorators/current-principal.decorator';
import type { PaginatedResponse } from '../common/handlers/base-query.handler';
import { BillingService } from './billing.service';
import { InvoiceParamsDto } from './dto/invoice-params.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices.query.dto';
import { MarkInvoicePaidDto } from './dto/mark-invoice-paid.dto';
import { PlatformAdminGuard } from './guards/platform-admin.guard';
import type { CollectionInvoiceRecord } from './interfaces/billing.interface';

/**
 * What the platform's own people do: chase and confirm the transfers coaches make. Money moves outside
 * the system, so confirming one is a person looking at a screenshot and saying so.
 */
@UseGuards(PlatformAdminGuard)
@Controller('admin/billing')
export class AdminBillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('invoices')
  invoices(
    @Query() query: ListInvoicesQueryDto,
  ): Promise<PaginatedResponse<CollectionInvoiceRecord>> {
    return this.billing.collections(query.status, query.page, query.limit);
  }

  @Post('invoices/:id/mark-paid')
  markPaid(
    @CurrentPrincipal() principal: Principal,
    @Param() params: InvoiceParamsDto,
    @Body() dto: MarkInvoicePaidDto,
  ): Promise<CollectionInvoiceRecord> {
    return this.billing.markInvoicePaid(params.id, principal.personId, dto);
  }

  @Post('invoices/:id/void')
  voidInvoice(
    @CurrentPrincipal() principal: Principal,
    @Param() params: InvoiceParamsDto,
  ): Promise<CollectionInvoiceRecord> {
    return this.billing.voidInvoice(params.id, principal.personId);
  }
}
