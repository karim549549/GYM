import { SubscriptionDatesPolicy } from './subscription-dates.policy';

const policy = new SubscriptionDatesPolicy();

describe('SubscriptionDatesPolicy', () => {
  describe('today', () => {
    it('is the date in Egypt, not in UTC', () => {
      // 23:30 UTC on 30 Jan is 01:30 on 31 Jan in Cairo (UTC+2 in winter)
      expect(policy.today(new Date('2027-01-30T23:30:00Z'))).toBe('2027-01-31');
    });

    it('is the same day when Cairo has not passed midnight yet', () => {
      expect(policy.today(new Date('2027-01-30T21:59:00Z'))).toBe('2027-01-30');
    });
  });

  describe('addDays', () => {
    it.each([
      ['2027-01-01', 29, '2027-01-30'],
      ['2027-01-31', 1, '2027-02-01'],
      ['2027-12-31', 1, '2028-01-01'],
      ['2028-02-28', 1, '2028-02-29'],
      ['2027-03-01', -1, '2027-02-28'],
      ['2027-03-01', 0, '2027-03-01'],
    ])('%s plus %i days is %s', (date, days, expected) => {
      expect(policy.addDays(date, days)).toBe(expected);
    });
  });

  describe('daysBetween', () => {
    it.each([
      ['2027-01-01', '2027-01-31', 30],
      ['2027-01-31', '2027-01-01', -30],
      ['2027-01-05', '2027-01-05', 0],
      ['2027-02-28', '2027-03-01', 1],
    ])('from %s to %s is %i', (from, to, expected) => {
      expect(policy.daysBetween(from, to)).toBe(expected);
    });
  });

  describe('endOfPackage', () => {
    it('counts the first day, so 30 days from the 1st ends on the 30th', () => {
      expect(policy.endOfPackage('2027-01-01', 30)).toBe('2027-01-30');
    });

    it('is the start itself for a one day package', () => {
      expect(policy.endOfPackage('2027-01-01', 1)).toBe('2027-01-01');
    });
  });

  describe('atHour', () => {
    it('is that hour in Egypt, which is UTC+2 in winter', () => {
      expect(policy.atHour('2027-01-15', 10)).toEqual(
        new Date('2027-01-15T08:00:00Z'),
      );
    });

    it('is that hour in Egypt, which is UTC+3 in summer', () => {
      expect(policy.atHour('2027-07-15', 10)).toEqual(
        new Date('2027-07-15T07:00:00Z'),
      );
    });
  });

  describe('monthOf', () => {
    it('ends on the 28th or 29th in February', () => {
      expect(policy.monthOf('2028-02-10').to).toBe('2028-02-29');
      expect(policy.monthOf('2027-02-10').to).toBe('2027-02-28');
    });

    it('is the first day of the month to its last day', () => {
      expect(policy.monthOf('2027-03-17')).toEqual({
        from: '2027-03-01',
        to: '2027-03-31',
      });
    });

    it('rolls over the end of the year', () => {
      expect(policy.monthOf('2027-12-31')).toEqual({
        from: '2027-12-01',
        to: '2027-12-31',
      });
    });
  });
});
