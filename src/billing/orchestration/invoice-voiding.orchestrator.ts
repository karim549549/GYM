import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import {
  InvoiceNotFoundException,
  InvoiceNotOpenException,
} from '../exceptions/billing-exceptions';
import { BillingQueryHandler } from '../handlers/billing-query.handler';
import type { CollectionInvoiceRecord } from '../interfaces/billing.interface';

/** Takes over `BillingService.voidInvoice`: an invoice raised in error is cancelled. Only an open one can be. */
@Injectable()
export class InvoiceVoidingOrchestrator {
  constructor(
    private readonly billingQuery: BillingQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    invoiceId: string,
    markedBy: string,
  ): Promise<CollectionInvoiceRecord> {
    return this.transactions.run(
      async () => {
        if (!(await this.billingQuery.findInvoice(invoiceId))) {
          throw new InvoiceNotFoundException();
        }
        if (!(await this.billingQuery.voidInvoice(invoiceId, markedBy))) {
          throw new InvoiceNotOpenException();
        }
        return (await this.billingQuery.findInvoice(
          invoiceId,
        )) as CollectionInvoiceRecord;
      },
      { system: true },
    );
  }
}
