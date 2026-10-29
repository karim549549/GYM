import { CheckinStatus } from '../enums/checkin-status.enum';
import { CheckinStatePolicy } from './checkin-state.policy';

const policy = new CheckinStatePolicy();

describe('CheckinStatePolicy', () => {
  describe('statusOf (what the coach sees)', () => {
    const submittedAt = new Date('2027-02-05T10:00:00Z');

    it('is submitted once handed in, even when it was late', () => {
      expect(
        policy.statusOf({
          dueOn: '2027-02-01',
          submittedAt,
          today: '2027-02-09',
        }),
      ).toBe(CheckinStatus.SUBMITTED);
    });

    it('is pending on its day and before', () => {
      expect(
        policy.statusOf({
          dueOn: '2027-02-05',
          submittedAt: null,
          today: '2027-02-05',
        }),
      ).toBe(CheckinStatus.PENDING);
      expect(
        policy.statusOf({
          dueOn: '2027-02-05',
          submittedAt: null,
          today: '2027-02-01',
        }),
      ).toBe(CheckinStatus.PENDING);
    });

    it('is missed the day after it was due', () => {
      expect(
        policy.statusOf({
          dueOn: '2027-02-05',
          submittedAt: null,
          today: '2027-02-06',
        }),
      ).toBe(CheckinStatus.MISSED);
    });
  });

  describe('accessOf (what the client opening the link can do)', () => {
    const open = { dueOn: '2027-02-05', submittedAt: null };

    it('opens on the day it is due', () => {
      expect(policy.accessOf({ ...open, today: '2027-02-05' }).outcome).toBe(
        'open',
      );
    });

    it('is not open before the day, since the link is only sent on it', () => {
      expect(policy.accessOf({ ...open, today: '2027-02-04' }).outcome).toBe(
        'not_yet',
      );
    });

    it('stays open for two weeks, the day 13 days later included', () => {
      expect(policy.accessOf({ ...open, today: '2027-02-18' }).outcome).toBe(
        'open',
      );
      expect(policy.accessOf({ ...open, today: '2027-02-19' }).outcome).toBe(
        'expired',
      );
    });

    it('is closed once handed in', () => {
      expect(
        policy.accessOf({
          dueOn: '2027-02-05',
          submittedAt: new Date('2027-02-05T10:00:00Z'),
          today: '2027-02-05',
        }).outcome,
      ).toBe('submitted');
    });
  });
});
