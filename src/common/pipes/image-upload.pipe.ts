import { PipeTransform } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import {
  FileRequiredException,
  FileTooLargeException,
  UnsupportedFileTypeException,
} from '../../storage/exceptions/storage-exceptions';

/** The part of a parsed upload this backend relies on. */
export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export interface ImageUploadRules {
  maxBytes: number;
}

/**
 * Boundary check for an uploaded image: it is there, it is not too big, and its bytes
 * really are one of the accepted formats. The name and the declared content type are
 * chosen by the sender, so neither is believed; the returned `mimetype` is what the
 * bytes say. Size is also capped while the body is read (multer's `limits` on the upload
 * interceptor), because this pipe only runs once the file is in memory. A purpose that
 * needs its own limits subclasses this and sets them.
 */
export class ImageUploadPipe implements PipeTransform<
  UploadedFile | undefined,
  Promise<UploadedFile>
> {
  private static readonly ACCEPTED_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);

  constructor(private readonly rules: ImageUploadRules) {}

  async transform(file: UploadedFile | undefined): Promise<UploadedFile> {
    if (!file?.buffer?.length) {
      throw new FileRequiredException();
    }
    if (file.buffer.length > this.rules.maxBytes) {
      throw new FileTooLargeException();
    }

    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected || !ImageUploadPipe.ACCEPTED_TYPES.has(detected.mime)) {
      throw new UnsupportedFileTypeException();
    }
    return { ...file, mimetype: detected.mime };
  }
}
