import { Injectable } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import { TransactionManager } from '../../database/transaction.manager';
import { PackagesService } from '../../packages/packages.service';
import { PaymentsService } from '../../payments/payments.service';
import { RemindersService } from '../../reminders/reminders.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import {
  ClientHasActiveSubscriptionException,
  PackageNotSoldException,
} from '../exceptions/subscription-exceptions';
import { SubscriptionsQueryHandler } from '../handlers/subscriptions-query.handler';
import type {
  SubscriptionRecord,
  SubscriptionSale,
} from '../interfaces/subscription.interface';
import { SubscriptionDatesPolicy } from '../policies/subscription-dates.policy';
import { SubscriptionStatePolicy } from '../policies/subscription-state.policy';
import { BaseSubscriptionOrchestrator } from './base-subscription.orchestrator';

/**
 * Takes over `SubscriptionsService.sell`. The package's name, price and currency are copied onto
 * the subscription. A client has one live subscription: one whose term is over is closed to make
 * room for the new one, but one still running is not touched, because that would throw away days
 * the client paid for.
 */
@Injectable()
export class SubscriptionCreationOrchestrator extends BaseSubscriptionOrchestrator {
  constructor(
    subscriptionsQuery: SubscriptionsQueryHandler,
    payments: PaymentsService,
    workspaces: WorkspacesService,
    dates: SubscriptionDatesPolicy,
    statePolicy: SubscriptionStatePolicy,
    transactions: TransactionManager,
    private readonly clients: ClientsService,
    private readonly packages: PackagesService,
    private readonly reminders: RemindersService,
  ) {
    super(
      subscriptionsQuery,
      payments,
      workspaces,
      dates,
      statePolicy,
      transactions,
    );
  }

  async execute(
    workspaceId: string,
    clientId: string,
    sale: SubscriptionSale,
  ): Promise<SubscriptionRecord> {
    try {
      return await this.transactions.run(
        async () => {
          await this.clients.findOne(workspaceId, clientId);
          const pkg = await this.packages.findOne(workspaceId, sale.packageId);
          if (!pkg.isActive) {
            throw new PackageNotSoldException();
          }

          const today = this.dates.today(new Date());
          await this.makeRoomFor(workspaceId, clientId, today);

          const startsOn = sale.startsOn ?? today;
          const created = await this.subscriptionsQuery.create(workspaceId, {
            clientId,
            packageId: pkg.id,
            packageName: pkg.name,
            priceMinor: sale.priceMinor ?? pkg.priceMinor,
            currency: pkg.currency,
            startsOn,
            endsOn: this.dates.endOfPackage(startsOn, pkg.durationDays),
          });
          await this.reminders.schedule(workspaceId, {
            clientId,
            subscriptionId: created.id,
            endsOn: created.endsOn,
          });
          return this.presentOne(workspaceId, created);
        },
        { workspaceId },
      );
    } catch (error) {
      // two sales can pass the check together; the database's rule is the last word
      throw ClientHasActiveSubscriptionException.causes(error)
        ? new ClientHasActiveSubscriptionException()
        : error;
    }
  }

  private async makeRoomFor(
    workspaceId: string,
    clientId: string,
    today: string,
  ): Promise<void> {
    const live = await this.subscriptionsQuery.lockLiveForClient(clientId);
    if (!live) {
      return;
    }
    const over =
      live.status === SubscriptionStatus.ACTIVE &&
      this.dates.daysBetween(today, live.endsOn) < 0;
    if (!over) {
      throw new ClientHasActiveSubscriptionException();
    }
    await this.subscriptionsQuery.setStatus(live.id, SubscriptionStatus.ENDED);
    await this.reminders.cancel(workspaceId, live.id);
  }
}
