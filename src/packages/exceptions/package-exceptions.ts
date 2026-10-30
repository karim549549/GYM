import { ConflictException, NotFoundException } from '@nestjs/common';

export class PackageNotFoundException extends NotFoundException {
  constructor() {
    super({ code: 'PACKAGE_NOT_FOUND', message: 'The package does not exist' });
  }
}

export class PackageInUseException extends ConflictException {
  static readonly CONSTRAINT = 'subscriptions_package_workspace_fk';

  constructor() {
    super({
      code: 'PACKAGE_IN_USE',
      message:
        'Subscriptions were sold on this package, so it cannot be deleted. Stop selling it instead.',
    });
  }

  /** Whether the database refused a delete because a subscription still points at the package. */
  static causes(error: unknown): boolean {
    for (
      let link: unknown = error, depth = 0;
      link && depth < 5;
      link = (link as { cause?: unknown }).cause, depth += 1
    ) {
      const { code, constraint } = link as {
        code?: string;
        constraint?: string;
      };
      if (code === '23503' && constraint === PackageInUseException.CONSTRAINT) {
        return true;
      }
    }
    return false;
  }
}
