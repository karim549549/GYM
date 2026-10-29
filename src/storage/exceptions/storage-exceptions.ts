import {
  BadRequestException,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';

export class FileStorageUnavailableException extends ServiceUnavailableException {
  constructor() {
    super({
      code: 'FILE_STORAGE_UNAVAILABLE',
      message: 'File storage is temporarily unavailable, try again shortly',
    });
  }
}

export class FileTooLargeException extends PayloadTooLargeException {
  constructor() {
    super({
      code: 'PAYLOAD_TOO_LARGE',
      message: 'The file is larger than the allowed size',
    });
  }
}

export class FileNotFoundException extends NotFoundException {
  constructor() {
    super({ code: 'FILE_NOT_FOUND', message: 'The file does not exist' });
  }
}

export class FileRequiredException extends BadRequestException {
  constructor() {
    super({ code: 'FILE_REQUIRED', message: 'Send the file to upload' });
  }
}

export class UnsupportedFileTypeException extends UnsupportedMediaTypeException {
  constructor() {
    super({
      code: 'UNSUPPORTED_FILE_TYPE',
      message: 'Only JPEG, PNG and WebP images are accepted',
    });
  }
}

export class InvalidImageException extends UnprocessableEntityException {
  constructor() {
    super({
      code: 'INVALID_IMAGE',
      message: 'The file could not be read as an image',
    });
  }
}
