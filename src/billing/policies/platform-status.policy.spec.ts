import { PlatformSubscriptionStatus } from '../enums/platform-subscription-status.enum';
import { PlatformStatusPolicy } from './platform-status.policy';

const policy = new PlatformStatusPolicy();

const active = {
  status: PlatformSubscriptionStatus.ACTIVE,
  currentPeriodEnd: '2027-02-28',
  priceMinor: 39_900,
};

describe('PlatformStatusPolicy', () => {
  it('is active within a paid period, its last day included', () => {
    expect(policy.statusOf({ ...active, today: '2027-02-28' })).toBe(
      PlatformSubscriptionStatus.ACTIVE,
    );
  });

  it('is past due the day after a paid period ends without being renewed', () => {
    expect(policy.statusOf({ ...active, today: '2027-03-01' })).toBe(
      PlatformSubscriptionStatus.PAST_DUE,
    );
  });

  it('is never past due on the free plan, which has no period to run out', () => {
    expect(
      policy.statusOf({
        status: PlatformSubscriptionStatus.ACTIVE,
        currentPeriodEnd: '9999-12-31',
        priceMinor: 0,
        today: '2030-01-01',
      }),
    ).toBe(PlatformSubscriptionStatus.ACTIVE);
  });

  it('keeps cancelled and trialing as they are', () => {
    expect(
      policy.statusOf({
        ...active,
        status: PlatformSubscriptionStatus.CANCELLED,
        today: '2028-01-01',
      }),
    ).toBe(PlatformSubscriptionStatus.CANCELLED);
    expect(
      policy.statusOf({
        ...active,
        status: PlatformSubscriptionStatus.TRIALING,
        today: '2028-01-01',
      }),
    ).toBe(PlatformSubscriptionStatus.TRIALING);
  });
});
