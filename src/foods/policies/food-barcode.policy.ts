import { Injectable } from '@nestjs/common';
import { isNumberString } from 'class-validator';

@Injectable()
export class FoodBarcodePolicy {
  check(barcode: string): { outcome: 'valid' | 'invalid' } {
    if (
      ![8, 12, 13, 14].includes(barcode.length) ||
      !isNumberString(barcode, { no_symbols: true })
    ) {
      return { outcome: 'invalid' };
    }
    const digits = barcode.split('').map(Number);
    const checkDigit = digits.pop();
    const sum = digits
      .reverse()
      .reduce(
        (total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1),
        0,
      );
    return {
      outcome: (10 - (sum % 10)) % 10 === checkDigit ? 'valid' : 'invalid',
    };
  }
}
