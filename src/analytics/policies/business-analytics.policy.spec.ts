import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { BusinessAnalyticsPolicy } from './business-analytics.policy';

const policy = new BusinessAnalyticsPolicy(new SubscriptionDatesPolicy());

describe('BusinessAnalyticsPolicy', () => {
  describe('lastMonths', () => {
    it('is the months up to and including this one, oldest first, each with its first and last day', () => {
      expect(policy.lastMonths('2027-03-17', 3)).toEqual([
        { month: '2027-01', from: '2027-01-01', to: '2027-01-31' },
        { month: '2027-02', from: '2027-02-01', to: '2027-02-28' },
        { month: '2027-03', from: '2027-03-01', to: '2027-03-31' },
      ]);
    });

    it('goes back over the end of the year', () => {
      expect(policy.lastMonths('2027-02-10', 4).map((m) => m.month)).toEqual([
        '2026-11',
        '2026-12',
        '2027-01',
        '2027-02',
      ]);
    });

    it('gives six months for the business view', () => {
      expect(policy.lastMonths('2027-06-30', 6)).toHaveLength(6);
    });
  });

  describe('measuringDay', () => {
    it('is the last day of a past month, and today for the current one', () => {
      const [january, february] = policy.lastMonths('2027-02-10', 2);

      expect(policy.measuringDay(january, '2027-02-10')).toBe('2027-01-31');
      expect(policy.measuringDay(february, '2027-02-10')).toBe('2027-02-10');
    });
  });

  describe('percent', () => {
    it('is the share to one decimal', () => {
      expect(policy.percent(2, 3)).toBe(66.7);
      expect(policy.percent(1, 4)).toBe(25);
      expect(policy.percent(4, 4)).toBe(100);
    });

    it('is nothing when there is no whole to be a share of', () => {
      expect(policy.percent(0, 0)).toBeNull();
    });
  });

  describe('average', () => {
    it('is the total over the count, rounded to a whole number', () => {
      expect(policy.average(1000, 3)).toBe(333);
      expect(policy.average(10, 4)).toBe(3);
    });

    it('is nothing when there is nothing to average', () => {
      expect(policy.average(0, 0)).toBeNull();
    });
  });
});
