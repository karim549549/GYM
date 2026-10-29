import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { Principal } from '../../auth/interfaces/principal.interface';
import { BillingService } from '../billing.service';
import { PlatformAdminOnlyException } from '../exceptions/billing-exceptions';

/**
 * Lets only the platform's own people through. The global auth guard has already proved who the
 * caller is; this asks whether they are in `platform_admins`, a table filled by hand by whoever runs
 * the deployment, so nothing in the API can make someone an admin.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly billing: BillingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { principal } = context
      .switchToHttp()
      .getRequest<{ principal?: Principal }>();
    if (
      !principal ||
      !(await this.billing.isPlatformAdmin(principal.personId))
    ) {
      throw new PlatformAdminOnlyException();
    }
    return true;
  }
}
