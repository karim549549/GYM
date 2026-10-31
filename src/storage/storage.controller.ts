import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { StorageBucket } from './enums/storage-bucket.enum';
import { StorageService } from './storage.service';

/** Local download routes. Private files require the disk's expiring signature. */
@Public()
@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Get('public/*key')
  publicFile(
    @Param('key') key: string | string[],
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.storage.servePublic(
      Array.isArray(key) ? key.join('/') : key,
      req,
      res,
    );
  }

  @Get('public-download')
  signedPublic(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.storage.serveSigned(StorageBucket.PUBLIC, req, res);
  }

  @Get('files')
  privateFile(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.storage.serveSigned(StorageBucket.FILES, req, res);
  }

  @Get('photos')
  privatePhoto(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.storage.serveSigned(StorageBucket.PHOTOS, req, res);
  }
}
