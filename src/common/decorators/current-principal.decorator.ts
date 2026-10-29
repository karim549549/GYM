import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Principal } from '../../auth/interfaces/principal.interface';

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal =>
    context.switchToHttp().getRequest<{ principal: Principal }>().principal,
);
