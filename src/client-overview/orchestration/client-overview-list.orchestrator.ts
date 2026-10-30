import { Injectable } from '@nestjs/common';
import { CheckinsService } from '../../checkins/checkins.service';
import type { PaginatedResponse } from '../../common/handlers/base-query.handler';
import { ClientsService } from '../../clients/clients.service';
import type { ClientListFilter } from '../../clients/interfaces/client.interface';
import { PlansService } from '../../plans/plans.service';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import type { ClientOverview } from '../interfaces/client-overview.interface';

/**
 * Takes over `ClientOverviewService.list`: a page of clients, each with what the list shows of
 * their subscription, plan and check-ins. Each of those belongs to another module, so this asks
 * their services once for the whole page instead of once per client.
 */
@Injectable()
export class ClientOverviewListOrchestrator {
  constructor(
    private readonly clients: ClientsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly plans: PlansService,
    private readonly checkins: CheckinsService,
  ) {}

  async execute(
    workspaceId: string,
    filter: ClientListFilter,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<ClientOverview>> {
    const result = await this.clients.list(workspaceId, filter, page, limit);
    const ids = result.items.map((client) => client.id);

    const [live, withPlan, checkinDays] = await Promise.all([
      this.subscriptions.liveFor(workspaceId, ids),
      this.plans.clientsWithActivePlan(workspaceId, ids),
      this.checkins.overviewFor(workspaceId, ids),
    ]);
    const subscriptionOf = new Map(live.map((sub) => [sub.clientId, sub]));
    const planned = new Set(withPlan);
    const checkinOf = new Map(checkinDays.map((row) => [row.clientId, row]));

    return {
      ...result,
      items: result.items.map((client) => {
        const subscription = subscriptionOf.get(client.id);
        const days = checkinOf.get(client.id);
        return {
          ...client,
          summary: {
            subscription: subscription
              ? {
                  id: subscription.id,
                  packageName: subscription.packageName,
                  state: subscription.state,
                  endsOn: subscription.endsOn,
                  daysLeft: subscription.daysLeft,
                }
              : null,
            hasPlan: planned.has(client.id),
            nextCheckinInDays: days?.nextInDays ?? null,
            missedCheckins: days?.missedCount ?? 0,
          },
        };
      }),
    };
  }
}
