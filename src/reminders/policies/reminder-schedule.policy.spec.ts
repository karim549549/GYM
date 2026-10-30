import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { ReminderAudience } from '../enums/reminder-audience.enum';
import { ReminderKind } from '../enums/reminder-kind.enum';
import { ReminderSchedulePolicy } from './reminder-schedule.policy';

const policy = new ReminderSchedulePolicy(new SubscriptionDatesPolicy());

describe('ReminderSchedulePolicy', () => {
  const long = new Date('2027-01-01T00:00:00Z');

  describe('forCheckin', () => {
    it('goes out at the chosen hour on the day it is due', () => {
      expect(
        policy.forCheckin('2027-01-15', '08:00', new Date('2027-01-10T00:00:00Z')),
      ).toEqual(new Date('2027-01-15T06:00:00Z'));
    });

    it('goes out straight away when that hour has already passed on the day', () => {
      const now = new Date('2027-01-15T09:30:00Z');

      expect(policy.forCheckin('2027-01-15', '08:00', now)).toEqual(now);
    });
  });

  it('tells the client three days before the end and again on the end date, at ten in the morning in Egypt', () => {
    expect(policy.forSubscription('2027-01-30', long)).toEqual([
      {
        kind: ReminderKind.EXPIRING_SOON,
        audience: ReminderAudience.CLIENT,
        // 10:00 on the 27th in Cairo, which is UTC+2 in winter
        scheduledFor: new Date('2027-01-27T08:00:00Z'),
      },
      {
        kind: ReminderKind.EXPIRED,
        audience: ReminderAudience.CLIENT,
        scheduledFor: new Date('2027-01-30T08:00:00Z'),
      },
    ]);
  });

  it('follows Egypt’s summer time, when ten o’clock is seven in UTC', () => {
    const [soon] = policy.forSubscription('2027-07-20', long);

    expect(soon.scheduledFor).toEqual(new Date('2027-07-17T07:00:00Z'));
  });

  it('leaves out what is already in the past', () => {
    const now = new Date('2027-01-28T12:00:00Z');

    const reminders = policy.forSubscription('2027-01-30', now);

    expect(reminders.map((r) => r.kind)).toEqual([ReminderKind.EXPIRED]);
  });

  it('leaves out the moment that is exactly now, which would have been sent already', () => {
    const now = new Date('2027-01-27T08:00:00Z');

    const reminders = policy.forSubscription('2027-01-30', now);

    expect(reminders.map((r) => r.kind)).toEqual([ReminderKind.EXPIRED]);
  });

  it('has nothing to say about a subscription that ended long ago', () => {
    expect(
      policy.forSubscription('2027-01-30', new Date('2027-03-01T00:00:00Z')),
    ).toEqual([]);
  });
});
