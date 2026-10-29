import { PaymentStatus } from '../enums/payment-status.enum';
import { SubscriptionState } from '../enums/subscription-state.enum';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { SubscriptionDatesPolicy } from './subscription-dates.policy';
import { SubscriptionStatePolicy } from './subscription-state.policy';

const policy = new SubscriptionStatePolicy(new SubscriptionDatesPolicy());

const base = {
  status: SubscriptionStatus.ACTIVE,
  endsOn: '2027-02-28',
  today: '2027-02-01',
  alertDays: 7,
  dueMinor: 0,
};

const stateOf = (overrides: Partial<typeof base> = {}) =>
  policy.stateOf({ ...base, ...overrides }).outcome;

describe('SubscriptionStatePolicy', () => {
  it('is active within the term, paid, and not close to the end', () => {
    expect(stateOf()).toBe(SubscriptionState.ACTIVE);
  });

  it('is expiring soon from the alert window onward, the last day of it included', () => {
    expect(stateOf({ endsOn: '2027-02-08' })).toBe(
      SubscriptionState.EXPIRING_SOON,
    );
    expect(stateOf({ endsOn: '2027-02-09' })).toBe(SubscriptionState.ACTIVE);
  });

  it('is expiring soon on the very last day, since it still covers today', () => {
    expect(stateOf({ endsOn: '2027-02-01' })).toBe(
      SubscriptionState.EXPIRING_SOON,
    );
  });

  it('uses the alert window the workspace chose', () => {
    expect(stateOf({ endsOn: '2027-02-15', alertDays: 14 })).toBe(
      SubscriptionState.EXPIRING_SOON,
    );
  });

  it('is expired the day after the end date', () => {
    expect(stateOf({ endsOn: '2027-01-31' })).toBe(SubscriptionState.EXPIRED);
  });

  it('is frozen while frozen, whatever the dates say', () => {
    expect(
      stateOf({ status: SubscriptionStatus.FROZEN, endsOn: '2027-01-01' }),
    ).toBe(SubscriptionState.FROZEN);
  });

  it('is payment overdue within the term when the amount is short', () => {
    expect(stateOf({ dueMinor: 50_000 })).toBe(
      SubscriptionState.PAYMENT_OVERDUE,
    );
  });

  it('shows the money owed before the approaching end', () => {
    expect(stateOf({ dueMinor: 1, endsOn: '2027-02-03' })).toBe(
      SubscriptionState.PAYMENT_OVERDUE,
    );
  });

  it('is expired, not overdue, once the term is over', () => {
    expect(stateOf({ dueMinor: 1, endsOn: '2027-01-01' })).toBe(
      SubscriptionState.EXPIRED,
    );
  });

  it('keeps ended and cancelled as they are', () => {
    expect(stateOf({ status: SubscriptionStatus.ENDED })).toBe(
      SubscriptionState.ENDED,
    );
    expect(stateOf({ status: SubscriptionStatus.CANCELLED, dueMinor: 5 })).toBe(
      SubscriptionState.CANCELLED,
    );
  });
});

describe('SubscriptionStatePolicy payment status', () => {
  const statusOf = (priceMinor: number, paidMinor: number) =>
    policy.paymentStatusOf({ priceMinor, paidMinor }).outcome;

  it('is unpaid before any money arrives', () => {
    expect(statusOf(150_000, 0)).toBe(PaymentStatus.UNPAID);
  });

  it('is partial once some arrived but not all', () => {
    expect(statusOf(150_000, 1)).toBe(PaymentStatus.PARTIAL);
    expect(statusOf(150_000, 149_999)).toBe(PaymentStatus.PARTIAL);
  });

  it('is paid when the whole price arrived', () => {
    expect(statusOf(150_000, 150_000)).toBe(PaymentStatus.PAID);
  });

  it('is paid for a free subscription', () => {
    expect(statusOf(0, 0)).toBe(PaymentStatus.PAID);
  });
});
