import {
  Controller,
  Get,
  Res,
  Logger,
  NotFoundException,
  InternalServerErrorException, // Import InternalServerErrorException
} from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { getOpenApiDocument } from '../main'; // Import the function to get the generated document

@Controller()
export class ScalarDocsController {
  private readonly logger = new Logger(ScalarDocsController.name);

  @Get('openapi.json')
  getOpenApiSpec() {
    const openApiDocument = getOpenApiDocument();
    if (!openApiDocument) {
      this.logger.error('OpenAPI document is not generated yet.');
      throw new InternalServerErrorException(
        'API documentation is not available yet.',
      );
    }
    return openApiDocument;
  }

  @Get('docs')
  getScalarDocs(@Res() res: Response) {
    try {
      const htmlFilePath = path.join(
        process.cwd(),
        'public',
        'scalar-docs.html',
      );
      if (!fs.existsSync(htmlFilePath)) {
        this.logger.error(`Scalar HTML file not found at: ${htmlFilePath}`);
        throw new Error('Scalar documentation page not found.');
      }
      res.sendFile(htmlFilePath, (err) => {
        if (err) {
          // Log the error but don't crash the server, let Nest handle response
          this.logger.error(
            `Failed to send Scalar docs file from ${htmlFilePath}`,
            err.stack,
          );
          // Optionally throw a standard Nest exception if the file MUST exist
          if (!res.headersSent) {
            throw new NotFoundException(`Scalar documentation file not found.`);
          }
        }
      });
    } catch (error) {
      this.logger.error(
        'Failed to serve Scalar documentation page:',
        error.stack,
      );
      if (!res.headersSent) {
        res.status(500).send('Could not load API documentation.');
      }
    }
  }
}
