import { Controller, Get, Logger, NotFoundException, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { BackblazeService } from '../common/services/backblaze.service';
import * as fs from 'fs';
import * as path from 'path';

@Controller()
export class PhotoProxyController {
  private readonly logger = new Logger(PhotoProxyController.name);
  constructor(private readonly backblazeService: BackblazeService) {}

  private contentTypeFor(name: string): string {
    const ext = path.extname(name).toLowerCase();
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.webp':
        return 'image/webp';
      case '.gif':
        return 'image/gif';
      default:
        return 'application/octet-stream';
    }
  }

  private async streamPhoto(name: string, res: Response) {
    const ct = this.contentTypeFor(name);
    const localPath = path.resolve(process.cwd(), 'uploads', 'inspection-photos', name);
    const legacyLocalPath = path.resolve(process.cwd(), 'uploads', 'inspection-photo', name); // legacy

    // First try local (new folder)
    if (fs.existsSync(localPath)) {
      this.logger.log(`Serving photo from local disk: ${localPath}`);
      res.setHeader('Content-Type', ct);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return fs.createReadStream(localPath).pipe(res);
    }

    // Try cloud (Backblaze) under uploads/inspection-photos
    const key = `uploads/inspection-photos/${name}`;
    try {
      const stream = await this.backblazeService.getFile(key);
      if (stream) {
        this.logger.log(`Proxying photo from Backblaze: ${key}`);
        res.setHeader('Content-Type', ct);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return stream.pipe(res);
      }
    } catch (err) {
      this.logger.warn(
        `Photo not found in Backblaze for key=${key}, will try legacy local: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Finally try legacy local folder
    if (fs.existsSync(legacyLocalPath)) {
      this.logger.log(`Serving legacy photo from local disk: ${legacyLocalPath}`);
      res.setHeader('Content-Type', ct);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return fs.createReadStream(legacyLocalPath).pipe(res);
    }

    this.logger.error(`Photo not found in Backblaze or local: ${name}`);
    throw new NotFoundException('Photo not found');
  }

  // Direct path used by external clients (Nginx maps to app with global prefix)
  @Get('uploads/inspection-photos/:name')
  async proxyUploads(@Param('name') name: string, @Res() res: Response) {
    return this.streamPhoto(name, res);
  }

  // Optionally expose v1 variant to mirror PDF proxy style
  @Get('v1/uploads/inspection-photos/:name')
  async proxyV1Uploads(@Param('name') name: string, @Res() res: Response) {
    return this.streamPhoto(name, res);
  }

  // Legacy singular folder support
  @Get('uploads/inspection-photo/:name')
  async proxyLegacy(@Param('name') name: string, @Res() res: Response) {
    return this.streamPhoto(name, res);
  }
}

