import { Controller, Get, NotFoundException, Param, Res, Req } from '@nestjs/common';
import { Response } from 'express';
import { BackblazeService } from '../common/services/backblaze.service';
import * as fs from 'fs';
import * as path from 'path';
import { ApiInternalServerErrorResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../common/dto/http-error-response.dto';
import { ApiStandardErrors } from '../common/decorators/api-standard-errors.decorator';
import { AppLogger } from '../logging/app-logger.service';

@ApiTags('Public Photos')
@Controller()
export class PhotoProxyController {
  constructor(private readonly backblazeService: BackblazeService, private readonly logger: AppLogger) {
    this.logger.setContext(PhotoProxyController.name);
  }

  private contentTypeFor(name?: string): string {
    const n = name || '';
    const ext = path.extname(n).toLowerCase();
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
    if (!name || typeof name !== 'string') {
      throw new NotFoundException('Photo not found');
    }
    // Basic sanitization
    const safe = name.replace(/^\/+/, '').replace(/\\/g, '/');
    if (safe.includes('..')) throw new NotFoundException('Photo not found');
    const ct = this.contentTypeFor(safe);
    const localPath = path.resolve(process.cwd(), 'uploads', 'inspection-photos', safe);
    const legacyLocalPath = path.resolve(process.cwd(), 'uploads', 'inspection-photo', safe); // legacy

    // First try local (new folder)
    if (fs.existsSync(localPath)) {
      this.logger.log(`Serving photo from local disk: ${localPath}`);
      res.setHeader('Content-Type', ct);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return fs.createReadStream(localPath).pipe(res);
    }

    // Try cloud (Backblaze) under uploads/inspection-photos
    const key = `uploads/inspection-photos/${safe}`;
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

    this.logger.error(`Photo not found in Backblaze or local: ${safe}`);
    throw new NotFoundException('Photo not found');
  }

  private normalizeStarParam(p: any): string {
    if (Array.isArray(p)) return p.join('/');
    if (typeof p === 'string') return p;
    return String(p || '');
  }

  // Wildcard to support nested paths like {inspectionId}/{category}/{filename}
  // Use a named param with (*) to work with both Express and Fastify
  @Get('uploads/inspection-photos/*path')
  @ApiOperation({ summary: 'Stream an inspection photo by wildcard path' })
  @ApiOkResponse({ description: 'Photo stream' })
  @ApiStandardErrors({ unauthorized: false, forbidden: false, notFound: 'Photo not found' })
  async proxyUploadsWildcard(
    @Param('path') path: any,
    @Res() res: Response,
    @Req() req: any,
  ) {
    const name = this.normalizeStarParam(path);
    if (!name) {
      // Fallback: derive from URL
      const url: string = (req?.url || '').toString();
      const idx = url.indexOf('/uploads/inspection-photos/');
      if (idx >= 0) {
        const candidate = url.slice(idx + '/uploads/inspection-photos/'.length);
        return this.streamPhoto(candidate, res);
      }
    }
    return this.streamPhoto(name, res);
  }

  // Note: v1-prefixed routes removed because global prefix already adds /api/v1
  // Keep single-segment fallback route for legacy clients
  @Get('uploads/inspection-photos/:name')
  @ApiOperation({ summary: 'Stream an inspection photo by name' })
  @ApiOkResponse({ description: 'Photo stream' })
  @ApiStandardErrors({ unauthorized: false, forbidden: false, notFound: 'Photo not found' })
  async proxyUploadsByName(@Param('name') name: string, @Res() res: Response) {
    return this.streamPhoto(name, res);
  }
}
