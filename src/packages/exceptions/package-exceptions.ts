import { NotFoundException } from '@nestjs/common';

export class PackageNotFoundException extends NotFoundException {
  constructor() {
    super({ code: 'PACKAGE_NOT_FOUND', message: 'The package does not exist' });
  }
}
