import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth:public';

/** The route needs no token at all. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
