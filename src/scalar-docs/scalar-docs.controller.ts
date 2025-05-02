import {
  Controller,
  Get,
  Res,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import { openApiDocument } from './openapi-spec';

@Controller('api-docs')
export class ScalarDocsController {
  // Inject Logger for potential future use or minimal error logging
  private readonly logger = new Logger(ScalarDocsController.name);

  @Get('openapi.json')
  getOpenApiSpec() {
    // Removed console.log
    return openApiDocument;
  }

  @Get()
  getScalarDocs(@Res() res: Response) {
    // Removed console.log and try...catch
    const filePath = path.join(process.cwd(), 'public', 'scalar-docs.html');

    res.sendFile(filePath, (err) => {
      if (err) {
        // Log the error but don't crash the server, let Nest handle response
        this.logger.error(
          `Failed to send Scalar docs file from ${filePath}`,
          err.stack,
        );
        // Optionally throw a standard Nest exception if the file MUST exist
        if (!res.headersSent) {
          throw new NotFoundException(`Scalar documentation file not found.`);
        }
      }
    });
  }
}
