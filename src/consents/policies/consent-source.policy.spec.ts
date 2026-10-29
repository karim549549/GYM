import { ConsentSource } from '../enums/consent-source.enum';
import { ConsentSourcePolicy } from './consent-source.policy';

const policy = new ConsentSourcePolicy();

describe('ConsentSourcePolicy', () => {
  it('lets a coach record a withdrawal on behalf of a client', () => {
    expect(
      policy.check(ConsentSource.COACH_ON_BEHALF, [
        { type: 'whatsapp_notifications', granted: false },
      ]).outcome,
    ).toBe('allowed');
  });

  it('never lets a coach give consent on behalf of a client', () => {
    expect(
      policy.check(ConsentSource.COACH_ON_BEHALF, [
        { type: 'health_data', granted: true },
      ]).outcome,
    ).toBe('refused');
  });

  it('lets the person themselves choose either way', () => {
    expect(
      policy.check(ConsentSource.CHECKIN_LINK, [
        { type: 'whatsapp_notifications', granted: true },
      ]).outcome,
    ).toBe('allowed');
  });
});
