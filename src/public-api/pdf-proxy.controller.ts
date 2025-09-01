import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { BackblazeService } from '../common/services/backblaze.service';
import { Stream } from 'stream';

@Controller()
export class PdfProxyController {
  private readonly logger = new Logger(PdfProxyController.name);
  constructor(private readonly backblazeService: BackblazeService) {}

  private async streamPdfToResponse(name: string, res: Response) {
    // Map any incoming route name to the bucket key under pdfarchived/
    const key = `pdfarchived/${name}`;
    this.logger.log(`Proxying PDF request for ${key}`);

    let stream: Stream | undefined;
    try {
      stream = await this.backblazeService.getFile(key);
    } catch (err) {
      this.logger.error(
        `Error fetching file ${key} from Backblaze: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new NotFoundException('File not found');
    }

    if (!stream) {
      throw new NotFoundException('File not found');
    }

    // Set caching headers and content-type for PDFs
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // Pipe the S3/Backblaze stream to the response
    stream.pipe(res);
  }

  // New proxied path used by frontend going forward
  @Get('v1/pdf/:name')
  async proxyV1(@Param('name') name: string, @Res() res: Response) {
    return this.streamPdfToResponse(name, res);
  }

  // Keep legacy path used when files were served from VPS
  @Get('pdfarchived/:name')
  async proxyArchived(@Param('name') name: string, @Res() res: Response) {
    return this.streamPdfToResponse(name, res);
  }

  // Also keep /pdf/:name for compatibility with earlier changes
  @Get('pdf/:name')
  async proxyPdf(@Param('name') name: string, @Res() res: Response) {
    return this.streamPdfToResponse(name, res);
  }
}
