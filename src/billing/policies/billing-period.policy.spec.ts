import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { BillingInterval } from '../enums/billing-interval.enum';
import { BillingPeriodPolicy } from './billing-period.policy';

const policy = new BillingPeriodPolicy(new SubscriptionDatesPolicy());

describe('BillingPeriodPolicy', () => {
  describe('periodFrom', () => {
    it('is a month ending the day before the same date next month', () => {
      expect(policy.periodFrom('2027-01-15', BillingInterval.MONTH)).toEqual({
        start: '2027-01-15',
        end: '2027-02-14',
      });
    });

    it('is a year ending the day before the same date next year', () => {
      expect(policy.periodFrom('2027-03-10', BillingInterval.YEAR)).toEqual({
        start: '2027-03-10',
        end: '2028-03-09',
      });
    });

    it('stays inside a shorter month: the 31st rolls to the end of the next month', () => {
      expect(policy.periodFrom('2027-01-31', BillingInterval.MONTH)).toEqual({
        start: '2027-01-31',
        end: '2027-02-27',
      });
    });

    it('rolls over the end of the year', () => {
      expect(policy.periodFrom('2027-12-01', BillingInterval.MONTH)).toEqual({
        start: '2027-12-01',
        end: '2027-12-31',
      });
    });

    it('handles a leap day', () => {
      expect(policy.periodFrom('2028-02-29', BillingInterval.YEAR)).toEqual({
        start: '2028-02-29',
        end: '2029-02-27',
      });
    });
  });

  describe('nextPeriod', () => {
    it('starts today when there is nothing running to continue', () => {
      expect(
        policy.nextPeriod({
          today: '2027-02-10',
          interval: BillingInterval.MONTH,
          runningUntil: null,
        }),
      ).toEqual({ start: '2027-02-10', end: '2027-03-09' });
    });

    it('starts today when the running one is already over', () => {
      expect(
        policy.nextPeriod({
          today: '2027-02-10',
          interval: BillingInterval.MONTH,
          runningUntil: '2027-02-01',
        }),
      ).toEqual({ start: '2027-02-10', end: '2027-03-09' });
    });

    it('continues the day after the running one ends, so paying early loses no days', () => {
      expect(
        policy.nextPeriod({
          today: '2027-02-10',
          interval: BillingInterval.MONTH,
          runningUntil: '2027-02-20',
        }),
      ).toEqual({ start: '2027-02-21', end: '2027-03-20' });
    });

    it('continues from the last day itself being today', () => {
      expect(
        policy.nextPeriod({
          today: '2027-02-10',
          interval: BillingInterval.YEAR,
          runningUntil: '2027-02-10',
        }),
      ).toEqual({ start: '2027-02-11', end: '2028-02-10' });
    });
  });
});
