import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { BackblazeService } from '../common/services/backblaze.service';
import { Stream } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import { ApiInternalServerErrorResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../common/dto/http-error-response.dto';
import { ApiStandardErrors } from '../common/decorators/api-standard-errors.decorator';
import { AppLogger } from '../logging/app-logger.service';

@ApiTags('Public PDF')
@Controller()
export class PdfProxyController {
  constructor(private readonly backblazeService: BackblazeService, private readonly logger: AppLogger) {
    this.logger.setContext(PdfProxyController.name);
  }

  private async streamPdfToResponse(name: string, res: Response) {
    // Map any incoming route name to the bucket key under pdfarchived/
    const key = `pdfarchived/${name}`;
    this.logger.log(`Proxying PDF request for ${key}`);

    // 1. Try get file from cloud (Backblaze)
    let stream: Stream | undefined;
    try {
      stream = await this.backblazeService.getFile(key);
      if (stream) {
        // Set caching headers and content-type for PDFs
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Cache-Control', 'public, max-age=3600');

        // Pipe the S3/Backblaze stream to the response
        stream.pipe(res);
      }

    } catch (err) {
      this.logger.warn(`File not found in Backblaze, will try local: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 2. If not found in the cloud, check file in local folder VPS
    const localPath = path.resolve(process.cwd(), 'pdfarchived', name);
    if (fs.existsSync(localPath)) {
      this.logger.log(`Serving legacy PDF from local disk: ${localPath}`);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      const fileStream = fs.createReadStream(localPath);
      return fileStream.pipe(res);
    }

    // 3. Jika tidak ada juga, 404
    this.logger.error(`File not found in Backblaze or local: ${name}`);
    throw new NotFoundException('File not found');
  }

  // Canonical route: use /pdfarchived to minimize confusion
  @Get('pdfarchived/:name')
  @ApiOperation({ summary: 'Stream a PDF (Backblaze/local fallback) under /pdfarchived' })
  @ApiOkResponse({ description: 'PDF stream' })
  @ApiStandardErrors({ unauthorized: false, forbidden: false, notFound: 'PDF not found' })
  async proxyPdfArchived(@Param('name') name: string, @Res() res: Response) {
    return this.streamPdfToResponse(name, res);
  }

  // Keep /pdf/:name as alias for compatibility with earlier changes
  @Get('pdf/:name')
  @ApiOperation({ summary: 'Alias: Stream PDF by name under /pdf (compat)' })
  @ApiOkResponse({ description: 'PDF stream' })
  @ApiStandardErrors({ unauthorized: false, forbidden: false, notFound: 'PDF not found' })
  async proxyPdfAlias(@Param('name') name: string, @Res() res: Response) {
    return this.streamPdfToResponse(name, res);
  }

  // Note: single /pdf/:name route already defined above
}
