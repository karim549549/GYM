import { FoodBarcodePolicy } from './food-barcode.policy';

describe('FoodBarcodePolicy', () => {
  const policy = new FoodBarcodePolicy();
  it.each(['96385074', '036000291452', '4006381333931', '10012345000017'])(
    'accepts GS1 %s',
    (barcode) => {
      expect(policy.check(barcode).outcome).toBe('valid');
    },
  );
  it.each([
    '96385075',
    '036000291453',
    '4006381333932',
    '10012345000018',
    '123456789',
    '1234',
    'abcdefgh',
    '٤٠٠٦٣٨١٣٣٣٩٣١',
  ])('refuses %s', (barcode) => {
    expect(policy.check(barcode).outcome).toBe('invalid');
  });
});
