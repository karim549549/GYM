import sharp from 'sharp';
import {
  FileRequiredException,
  FileTooLargeException,
  UnsupportedFileTypeException,
} from '../../storage/exceptions/storage-exceptions';
import { ImageUploadPipe, type UploadedFile } from './image-upload.pipe';

const image = (format: 'png' | 'jpeg' | 'webp' | 'gif') =>
  sharp({
    create: { width: 8, height: 8, channels: 3, background: 'teal' },
  })
    [format]()
    .toBuffer();

const upload = (
  buffer: Buffer,
  mimetype = 'application/octet-stream',
): UploadedFile => ({
  buffer,
  mimetype,
  size: buffer.length,
});

const pipe = (maxBytes = 1_000_000) => new ImageUploadPipe({ maxBytes });

describe('ImageUploadPipe', () => {
  it.each([
    ['png', 'image/png'],
    ['jpeg', 'image/jpeg'],
    ['webp', 'image/webp'],
  ] as const)('accepts a real %s image', async (format, mime) => {
    const bytes = await image(format);

    const result = await pipe().transform(upload(bytes, mime));

    expect(result.buffer).toBe(bytes);
    expect(result.mimetype).toBe(mime);
  });

  it('believes the bytes, not the declared type', async () => {
    const png = await image('png');

    const result = await pipe().transform(upload(png, 'image/jpeg'));

    expect(result.mimetype).toBe('image/png');
  });

  it('accepts an image whose declared type is wrong or missing', async () => {
    const jpeg = await image('jpeg');

    await expect(
      pipe().transform(upload(jpeg, 'text/plain')),
    ).resolves.toMatchObject({ mimetype: 'image/jpeg' });
  });

  it.each([undefined, null])('requires a file, got %p', async (missing) => {
    await expect(
      pipe().transform(missing as unknown as UploadedFile),
    ).rejects.toBeInstanceOf(FileRequiredException);
  });

  it('requires a file that has bytes', async () => {
    await expect(
      pipe().transform(upload(Buffer.alloc(0), 'image/png')),
    ).rejects.toBeInstanceOf(FileRequiredException);
  });

  it('refuses a file over the size limit, by its real length', async () => {
    const bytes = await image('png');
    const lying = { ...upload(bytes, 'image/png'), size: 1 };

    await expect(
      new ImageUploadPipe({ maxBytes: bytes.length - 1 }).transform(lying),
    ).rejects.toBeInstanceOf(FileTooLargeException);
  });

  it('accepts a file exactly at the size limit', async () => {
    const bytes = await image('png');

    await expect(
      new ImageUploadPipe({ maxBytes: bytes.length }).transform(
        upload(bytes, 'image/png'),
      ),
    ).resolves.toBeDefined();
  });

  describe('refuses what is not an accepted image, whatever it claims to be', () => {
    const cases: Array<[string, () => Promise<Buffer> | Buffer]> = [
      ['a gif', () => image('gif')],
      [
        'an svg',
        () =>
          Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
          ),
      ],
      [
        'an html page',
        () => Buffer.from('<html><script>alert(1)</script></html>'),
      ],
      ['a pdf', () => Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n')],
      ['plain text', () => Buffer.from('just some text')],
      [
        'a script named like an image',
        () => Buffer.from('#!/bin/sh\nrm -rf /\n'),
      ],
      [
        'random bytes',
        () => Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
      ],
    ];

    it.each(cases)('%s', async (_label, make) => {
      await expect(
        pipe().transform(upload(await make(), 'image/png')),
      ).rejects.toBeInstanceOf(UnsupportedFileTypeException);
    });
  });
});
