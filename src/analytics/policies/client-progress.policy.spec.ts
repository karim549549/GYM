import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { ClientProgressPolicy } from './client-progress.policy';

const policy = new ClientProgressPolicy(new SubscriptionDatesPolicy());

const point = (date: string, value: number) => ({ date, value });

describe('ClientProgressPolicy', () => {
  describe('weight', () => {
    it('is the first and the latest reading and what changed between them', () => {
      const weight = policy.weight(
        'kg',
        [
          point('2027-01-01', 90),
          point('2027-01-15', 88),
          point('2027-02-01', 85.5),
        ],
        80,
        '2027-02-01',
      );

      expect(weight).toMatchObject({
        unit: 'kg',
        target: 80,
        first: point('2027-01-01', 90),
        latest: point('2027-02-01', 85.5),
        change: -4.5,
      });
    });

    it('is empty before any reading', () => {
      expect(policy.weight(null, [], null, '2027-02-01')).toEqual({
        unit: null,
        points: [],
        target: null,
        first: null,
        latest: null,
        change: null,
        weeklyRate: null,
      });
    });

    it('has no change from a single reading', () => {
      const weight = policy.weight(
        'kg',
        [point('2027-02-01', 85)],
        null,
        '2027-02-01',
      );

      expect(weight).toMatchObject({
        first: point('2027-02-01', 85),
        change: 0,
      });
      expect(weight.weeklyRate).toBeNull();
    });

    it('works out the pace over the last four weeks, in units a week', () => {
      // 4 kg in 28 days: one kilogram a week
      const weight = policy.weight(
        'kg',
        [point('2027-01-04', 90), point('2027-02-01', 86)],
        null,
        '2027-02-01',
      );

      expect(weight.weeklyRate).toBe(-1);
    });

    it('ignores readings older than four weeks for the pace, but not for the change', () => {
      const weight = policy.weight(
        'kg',
        [
          point('2026-12-01', 100),
          point('2027-01-18', 90),
          point('2027-02-01', 88),
        ],
        null,
        '2027-02-01',
      );

      expect(weight.change).toBe(-12);
      expect(weight.weeklyRate).toBe(-1);
    });

    it('has no pace when only one reading is in the last four weeks', () => {
      const weight = policy.weight(
        'kg',
        [point('2026-11-01', 100), point('2027-02-01', 88)],
        null,
        '2027-02-01',
      );

      expect(weight.weeklyRate).toBeNull();
    });

    it('rounds the pace to two decimals', () => {
      const weight = policy.weight(
        'kg',
        [point('2027-01-20', 90), point('2027-02-01', 88.9)],
        null,
        '2027-02-01',
      );

      expect(weight.weeklyRate).toBe(-0.64);
    });
  });

  describe('adherence', () => {
    const handedIn = (nutritionDays: number, trainingDays: number) => ({
      dueOn: '2027-01-20',
      submittedAt: new Date('2027-01-20T10:00:00Z'),
      answers: { nutritionDays, trainingDays },
    });
    const missed = { dueOn: '2027-01-27', submittedAt: null, answers: null };

    it('averages the days followed, out of seven', () => {
      expect(policy.adherence([handedIn(7, 4), handedIn(5, 2)])).toEqual({
        nutritionPct: 85.7,
        trainingPct: 42.9,
        checkinRatePct: 100,
      });
    });

    it('counts a check-in not handed in against the rate, but not against the days', () => {
      expect(policy.adherence([handedIn(7, 7), missed])).toEqual({
        nutritionPct: 100,
        trainingPct: 100,
        checkinRatePct: 50,
      });
    });

    it('is nothing to report with no check-ins', () => {
      expect(policy.adherence([])).toEqual({
        nutritionPct: null,
        trainingPct: null,
        checkinRatePct: null,
      });
    });

    it('has a rate of zero and no days when every check-in was missed', () => {
      expect(policy.adherence([missed, missed])).toEqual({
        nutritionPct: null,
        trainingPct: null,
        checkinRatePct: 0,
      });
    });
  });

  describe('weeksCompleted', () => {
    it('is whole weeks since the first subscription began', () => {
      expect(policy.weeksCompleted('2027-01-01', '2027-02-01')).toBe(4);
      expect(policy.weeksCompleted('2027-01-01', '2027-01-07')).toBe(0);
    });

    it('is nothing before there was a subscription, and never negative', () => {
      expect(policy.weeksCompleted(null, '2027-02-01')).toBeNull();
      expect(policy.weeksCompleted('2027-03-01', '2027-02-01')).toBe(0);
    });
  });
});
