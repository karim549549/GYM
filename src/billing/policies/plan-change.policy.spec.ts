import { BillingInterval } from '../enums/billing-interval.enum';
import type { PlatformPlanRecord } from '../interfaces/billing.interface';
import { PlanChangePolicy } from './plan-change.policy';

const policy = new PlanChangePolicy();

const plan = (
  id: string,
  priceMinor: number,
  clientLimit: number | null,
  interval = BillingInterval.MONTH,
): PlatformPlanRecord => ({
  id,
  name: id,
  priceMinor,
  currency: 'EGP',
  clientLimit,
  interval,
});
const free = plan('free', 0, 5);
const basic = plan('basic', 39_900, 30);
const pro = plan('pro', 79_900, null);

describe('PlanChangePolicy', () => {
  it('asks for an invoice to move to a paid plan', () => {
    expect(
      policy.decide({ current: free, target: basic, activeClients: 3 }).outcome,
    ).toBe('invoice');
  });

  it('asks for an invoice to pay the same paid plan again: a renewal', () => {
    expect(
      policy.decide({ current: basic, target: basic, activeClients: 20 })
        .outcome,
    ).toBe('invoice');
  });

  it('moves to the free plan at once, there being nothing to pay', () => {
    expect(
      policy.decide({ current: basic, target: free, activeClients: 4 }).outcome,
    ).toBe('free_now');
  });

  it('has nothing to do for someone already on the free plan', () => {
    expect(
      policy.decide({ current: free, target: free, activeClients: 0 }).outcome,
    ).toBe('already_free');
  });

  it('refuses a plan with fewer places than the coach has clients', () => {
    expect(
      policy.decide({ current: pro, target: basic, activeClients: 31 }).outcome,
    ).toBe('limit_below_clients');
    expect(
      policy.decide({ current: basic, target: free, activeClients: 6 }).outcome,
    ).toBe('limit_below_clients');
  });

  it('allows a plan whose limit is exactly the number of clients', () => {
    expect(
      policy.decide({ current: pro, target: basic, activeClients: 30 }).outcome,
    ).toBe('invoice');
  });

  it('never refuses an unlimited plan', () => {
    expect(
      policy.decide({ current: basic, target: pro, activeClients: 30 }).outcome,
    ).toBe('invoice');
  });
});
