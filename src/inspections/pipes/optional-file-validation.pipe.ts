import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import { extname } from 'path';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = /^image\/(jpg|jpeg|png)$/;
const ALLOWED_EXTENSIONS = /\.(jpg|jpeg|png)$/i;

/**
 * Similar to FileValidationPipe but allows "no file" (undefined) for optional uploads.
 * If a file is present, validates size and type; if not, passes through undefined.
 */
@Injectable()
export class OptionalFileValidationPipe implements PipeTransform {
  private readonly logger = new Logger(OptionalFileValidationPipe.name);

  async transform(
    file: Express.Multer.File | undefined,
    _metadata: ArgumentMetadata,
  ) {
    if (!file) {
      // No file provided — this is acceptable for optional upload endpoints
      return undefined;
    }

    // Validate a single file
    await this.validateFile(file);
    return file;
  }

  private async validateFile(file: Express.Multer.File): Promise<void> {
    if (!file) {
      throw new BadRequestException('Invalid file uploaded.');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File "${file.originalname}" exceeds the size limit of 5 MB.`,
      );
    }

    if (
      !ALLOWED_MIME_TYPES.test(file.mimetype) ||
      !ALLOWED_EXTENSIONS.test(extname(file.originalname))
    ) {
      throw new BadRequestException(
        `File "${file.originalname}" has an invalid type. Only JPG, JPEG, and PNG are allowed.`,
      );
    }

    try {
      const { fileTypeFromBuffer } = await (eval(
        'import("file-type")',
      ) as Promise<typeof import('file-type')>);

      const buffer =
        (file as any).buffer || (file.path ? await fs.readFile(file.path) : undefined);
      if (!buffer) {
        throw new BadRequestException('File buffer is missing');
      }
      const type = await fileTypeFromBuffer(buffer as unknown as Buffer);

      if (!type || !ALLOWED_MIME_TYPES.test(type.mime)) {
        throw new BadRequestException(
          `File content of "${file.originalname}" does not match its extension.`,
        );
      }
    } catch (error) {
      this.logger.error(`Validation failed for ${file.originalname}:`, error as Error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Could not validate file type.');
    }
  }
}

