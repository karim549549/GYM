import type { CheckinsService } from '../../checkins/checkins.service';
import type { ClientsService } from '../../clients/clients.service';
import { IntakeStatus } from '../../clients/enums/intake-status.enum';
import type { PlansService } from '../../plans/plans.service';
import { SubscriptionState } from '../../subscriptions/enums/subscription-state.enum';
import type { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { ClientOverviewListOrchestrator } from './client-overview-list.orchestrator';

const client = (id: string) => ({
  id,
  fullName: `Client ${id}`,
  phone: '+201012345678',
  intakeStatus: IntakeStatus.PENDING,
  personId: null,
  createdAt: new Date('2027-01-01T00:00:00Z'),
});

function setup() {
  const clients = {
    list: jest.fn().mockResolvedValue({
      items: [client('c1'), client('c2')],
      total: 2,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    }),
  };
  const subscriptions = {
    liveFor: jest.fn().mockResolvedValue([
      {
        id: 's1',
        clientId: 'c1',
        packageName: 'Monthly',
        state: SubscriptionState.EXPIRING_SOON,
        endsOn: '2027-02-03',
        daysLeft: 3,
      },
    ]),
  };
  const plans = { clientsWithActivePlan: jest.fn().mockResolvedValue(['c2']) };
  const checkins = {
    overviewFor: jest
      .fn()
      .mockResolvedValue([{ clientId: 'c1', nextInDays: 2, missedCount: 1 }]),
  };
  const orchestrator = new ClientOverviewListOrchestrator(
    clients as unknown as ClientsService,
    subscriptions as unknown as SubscriptionsService,
    plans as unknown as PlansService,
    checkins as unknown as CheckinsService,
  );
  return { clients, subscriptions, plans, checkins, orchestrator };
}

describe('ClientOverviewListOrchestrator', () => {
  it('adds to each client what the list shows of their subscription, plan and check-ins', async () => {
    const { orchestrator } = setup();

    const result = await orchestrator.execute('w1', {});

    expect(result.items[0].summary).toEqual({
      subscription: {
        id: 's1',
        packageName: 'Monthly',
        state: SubscriptionState.EXPIRING_SOON,
        endsOn: '2027-02-03',
        daysLeft: 3,
      },
      hasPlan: false,
      nextCheckinInDays: 2,
      missedCheckins: 1,
    });
    expect(result.items[1].summary).toEqual({
      subscription: null,
      hasPlan: true,
      nextCheckinInDays: null,
      missedCheckins: 0,
    });
  });

  it('asks each module once for the whole page, not once per client', async () => {
    const { orchestrator, subscriptions, plans, checkins } = setup();

    await orchestrator.execute('w1', {});

    expect(subscriptions.liveFor).toHaveBeenCalledTimes(1);
    expect(subscriptions.liveFor).toHaveBeenCalledWith('w1', ['c1', 'c2']);
    expect(plans.clientsWithActivePlan).toHaveBeenCalledWith('w1', ['c1', 'c2']);
    expect(checkins.overviewFor).toHaveBeenCalledWith('w1', ['c1', 'c2']);
  });

  it('keeps the paging of the clients', async () => {
    const { orchestrator } = setup();

    const result = await orchestrator.execute('w1', {});

    expect(result).toMatchObject({ total: 2, page: 1, limit: 20, hasNext: false });
  });
});
