import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { CheckinFrequency } from '../enums/checkin-frequency.enum';
import { CheckinSchedulePolicy } from './checkin-schedule.policy';

const policy = new CheckinSchedulePolicy(new SubscriptionDatesPolicy());

// 2027-02-01 is a Monday
const FRIDAY = 5;

describe('CheckinSchedulePolicy', () => {
  describe('dueDatesFrom', () => {
    it('lists every day for a daily check-in, today included', () => {
      expect(
        policy.dueDatesFrom(
          { frequency: CheckinFrequency.DAILY, dayOfWeek: null },
          '2027-02-01',
          '2027-02-04',
        ),
      ).toEqual(['2027-02-01', '2027-02-02', '2027-02-03', '2027-02-04']);
    });

    it('lists every other day for an every-two-days check-in', () => {
      expect(
        policy.dueDatesFrom(
          { frequency: CheckinFrequency.EVERY_2_DAYS, dayOfWeek: null },
          '2027-02-01',
          '2027-02-06',
        ),
      ).toEqual(['2027-02-01', '2027-02-03', '2027-02-05']);
    });

    it('starts a weekly check-in on the first chosen weekday on or after the start', () => {
      expect(
        policy.dueDatesFrom(
          { frequency: CheckinFrequency.WEEKLY, dayOfWeek: FRIDAY },
          '2027-02-01',
          '2027-02-20',
        ),
      ).toEqual(['2027-02-05', '2027-02-12', '2027-02-19']);
    });

    it('counts the start itself when it already is the chosen weekday', () => {
      expect(
        policy.dueDatesFrom(
          { frequency: CheckinFrequency.WEEKLY, dayOfWeek: FRIDAY },
          '2027-02-05',
          '2027-02-12',
        ),
      ).toEqual(['2027-02-05', '2027-02-12']);
    });

    it('asks every second week for a fortnightly check-in', () => {
      expect(
        policy.dueDatesFrom(
          { frequency: CheckinFrequency.FORTNIGHTLY, dayOfWeek: FRIDAY },
          '2027-02-01',
          '2027-03-10',
        ),
      ).toEqual(['2027-02-05', '2027-02-19', '2027-03-05']);
    });

    it('defaults a weekly check-in to Friday when no day was chosen', () => {
      expect(
        policy.dueDatesFrom(
          { frequency: CheckinFrequency.WEEKLY, dayOfWeek: null },
          '2027-02-01',
          '2027-02-07',
        ),
      ).toEqual(['2027-02-05']);
    });

    it('is empty when the end is before the first date', () => {
      expect(
        policy.dueDatesFrom(
          { frequency: CheckinFrequency.WEEKLY, dayOfWeek: FRIDAY },
          '2027-02-01',
          '2027-02-03',
        ),
      ).toEqual([]);
    });
  });

  describe('dueDatesAfter', () => {
    it('carries on from the last one by the same step, so the rhythm does not drift', () => {
      expect(
        policy.dueDatesAfter(
          { frequency: CheckinFrequency.FORTNIGHTLY, dayOfWeek: FRIDAY },
          '2027-02-19',
          '2027-04-02',
        ),
      ).toEqual(['2027-03-05', '2027-03-19', '2027-04-02']);
    });

    it('is empty when the last one already reaches the end', () => {
      expect(
        policy.dueDatesAfter(
          { frequency: CheckinFrequency.DAILY, dayOfWeek: null },
          '2027-02-10',
          '2027-02-10',
        ),
      ).toEqual([]);
    });
  });

  describe('dayOfWeekFor', () => {
    it('is kept for weekly and fortnightly, and dropped where it means nothing', () => {
      expect(policy.dayOfWeekFor(CheckinFrequency.WEEKLY, 2)).toBe(2);
      expect(policy.dayOfWeekFor(CheckinFrequency.FORTNIGHTLY, 2)).toBe(2);
      expect(policy.dayOfWeekFor(CheckinFrequency.DAILY, 2)).toBeNull();
      expect(policy.dayOfWeekFor(CheckinFrequency.EVERY_2_DAYS, 2)).toBeNull();
    });

    it('falls back to Friday for a weekly check-in with no day', () => {
      expect(policy.dayOfWeekFor(CheckinFrequency.WEEKLY, undefined)).toBe(5);
    });
  });
});
