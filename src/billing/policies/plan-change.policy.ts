import { Injectable } from '@nestjs/common';
import type { PlatformPlanRecord } from '../interfaces/billing.interface';

export type PlanChangeDecision = {
  outcome: 'invoice' | 'free_now' | 'already_free' | 'limit_below_clients';
};

/**
 * What asking for a plan does. A plan with fewer places than the coach has clients is refused, so
 * nobody is left over their limit by their own choice. The free plan costs nothing, so it takes
 * effect at once; any paid plan, the one they are on included (a renewal), needs an invoice paid.
 */
@Injectable()
export class PlanChangePolicy {
  decide(input: {
    current: PlatformPlanRecord;
    target: PlatformPlanRecord;
    activeClients: number;
  }): PlanChangeDecision {
    const { current, target, activeClients } = input;

    if (target.clientLimit !== null && activeClients > target.clientLimit) {
      return { outcome: 'limit_below_clients' };
    }
    if (target.priceMinor === 0) {
      return {
        outcome: current.priceMinor === 0 ? 'already_free' : 'free_now',
      };
    }
    return { outcome: 'invoice' };
  }
}
