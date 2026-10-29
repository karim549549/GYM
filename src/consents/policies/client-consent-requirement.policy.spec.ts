import { ClientConsentType } from '../enums/client-consent-type.enum';
import { ClientConsentRequirementPolicy } from './client-consent-requirement.policy';

const policy = new ClientConsentRequirementPolicy();

describe('ClientConsentRequirementPolicy', () => {
  it('accepts when data processing and health data are both granted', () => {
    expect(
      policy.check([
        { type: ClientConsentType.DATA_PROCESSING, granted: true },
        { type: ClientConsentType.HEALTH_DATA, granted: true },
      ]).outcome,
    ).toBe('ok');
  });

  it('does not need the optional WhatsApp consent', () => {
    expect(
      policy.check([
        { type: ClientConsentType.DATA_PROCESSING, granted: true },
        { type: ClientConsentType.HEALTH_DATA, granted: true },
        { type: ClientConsentType.WHATSAPP_NOTIFICATIONS, granted: false },
      ]).outcome,
    ).toBe('ok');
  });

  it('names what is missing when one is absent or refused', () => {
    const decision = policy.check([
      { type: ClientConsentType.DATA_PROCESSING, granted: true },
      { type: ClientConsentType.HEALTH_DATA, granted: false },
    ]);

    expect(decision).toEqual({
      outcome: 'missing',
      missing: [ClientConsentType.HEALTH_DATA],
    });
  });

  it('names both when nothing was sent', () => {
    expect(policy.check([])).toEqual({
      outcome: 'missing',
      missing: [
        ClientConsentType.DATA_PROCESSING,
        ClientConsentType.HEALTH_DATA,
      ],
    });
  });
});
