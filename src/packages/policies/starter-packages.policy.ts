import { Injectable } from '@nestjs/common';
import type { NewPackage } from '../interfaces/package.interface';

/**
 * What a coach starts with: one, three and six months, named in Arabic. The price is left
 * at zero because only the coach knows it; the product asks them to set it.
 */
@Injectable()
export class StarterPackagesPolicy {
  starterPackages(): NewPackage[] {
    return [
      { name: 'شهر واحد', durationDays: 30, priceMinor: 0 },
      { name: '3 شهور', durationDays: 90, priceMinor: 0 },
      { name: '6 شهور', durationDays: 180, priceMinor: 0 },
    ];
  }
}
