import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import type { Express } from 'express';

@Injectable()
export class BackblazeService {
  private readonly logger = new Logger(BackblazeService.name);
  private s3Client: S3Client;
  private readonly bucketName: string | undefined;
  private readonly endpoint: string | undefined;

  constructor(private readonly config: ConfigService) {
    const accessKeyId = this.config.get<string>('STORAGE_APPLICATION_KEY_ID');
    const secretAccessKey = this.config.get<string>('STORAGE_APPLICATION_KEY');
    const region = this.config.get<string>('STORAGE_REGION');
    this.endpoint = this.config.get<string>('STORAGE_ENDPOINT');
    this.bucketName = this.config.get<string>('STORAGE_BUCKET_NAME');

    if (!accessKeyId || !secretAccessKey) {
      this.logger.warn(
        'Backblaze credentials (STORAGE_APPLICATION_KEY_ID / STORAGE_APPLICATION_KEY) are not set',
      );
    }

    this.logger.debug(
      `BackblazeService constructor: endpoint=${this.endpoint ?? 'N/A'}, bucket=${this.bucketName ?? 'N/A'}, region=${region ?? 'N/A'}`,
    );

    this.s3Client = new S3Client({
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
      endpoint: this.endpoint || undefined,
      region: region || undefined,
      // Backblaze is S3-compatible; default client options usually work.
    });
  }

  // Upload a file (from multer) to Backblaze B2 (S3-compatible)
  async uploadFile(
    file: Express.Multer.File,
    bucketName?: string,
  ): Promise<string> {
    const bucket = bucketName || this.bucketName;
    if (!bucket) throw new Error('Bucket name not configured');
    const key = file.originalname;
    this.logger.debug(
      `uploadFile: uploading key='${key}' to bucket='${bucket}' (size=${file.buffer?.length ?? 'unknown'})`,
    );
    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    try {
      await this.s3Client.send(cmd);
      this.logger.log(
        `uploadFile: successfully uploaded '${key}' to bucket '${bucket}'`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `uploadFile: failed to upload '${key}' to bucket '${bucket}': ${msg}`,
      );
      throw err;
    }

    // Construct a public URL. Backblaze can expose files under a public bucket URL.
    // The exact public host may differ by account; we build a reasonable URL from STORAGE_ENDPOINT.
    const endpoint = (this.endpoint || '')
      .replace(/^http:\/\//, 'https://')
      .replace(/\/$/, '');
    // Many Backblaze public URLs follow /file/{bucket}/{key}
    const publicUrl = `${endpoint}/file/${bucket}/${encodeURIComponent(key)}`;
    this.logger.debug(`uploadFile: public URL for '${key}' => ${publicUrl}`);
    return publicUrl;
  }

  /**
   * Upload a Buffer directly to the configured bucket. Returns a public URL.
   */
  async uploadBuffer(
    buffer: Buffer,
    key: string,
    contentType: string = 'application/octet-stream',
    bucketName?: string,
  ): Promise<string> {
    const bucket = bucketName || this.bucketName;
    if (!bucket) throw new Error('Bucket name not configured');
    this.logger.debug(
      `uploadBuffer: uploading key='${key}' to bucket='${bucket}' (size=${buffer.length})`,
    );
    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    try {
      await this.s3Client.send(cmd);
      this.logger.log(
        `uploadBuffer: successfully uploaded '${key}' to bucket '${bucket}'`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `uploadBuffer: failed to upload '${key}' to bucket '${bucket}': ${msg}`,
      );
      throw err;
    }

    const endpoint = (this.endpoint || '')
      .replace(/^http:\/\//, 'https://')
      .replace(/\/$/, '');
    const publicUrl = `${endpoint}/file/${bucket}/${encodeURIComponent(key)}`;
    this.logger.debug(`uploadBuffer: public URL for '${key}' => ${publicUrl}`);
    return publicUrl;
  }

  /**
   * Upload a PDF buffer into the `pdfarchived/` prefix and return a public URL.
   * This ensures PDFs are stored under the `pdfarchived` path in the bucket and
   * the returned URL points to /file/{bucket}/pdfarchived/{filename}.
   */
  async uploadPdfBuffer(
    buffer: Buffer,
    filename: string,
    bucketName?: string,
  ): Promise<string> {
    const key = `pdfarchived/${filename}`;
    this.logger.debug(
      `uploadPdfBuffer: uploading pdf '${filename}' as key='${key}'`,
    );
    try {
      const url = await this.uploadBuffer(
        buffer,
        key,
        'application/pdf',
        bucketName,
      );
      this.logger.log(`uploadPdfBuffer: uploaded pdf '${filename}' => ${url}`);
      return url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `uploadPdfBuffer: failed to upload pdf '${filename}': ${msg}`,
      );
      throw err;
    }
  }

  // Get an object stream from Backblaze
  async getFile(
    fileName: string,
    bucketName?: string,
  ): Promise<Readable | undefined> {
    const bucket = bucketName || this.bucketName;
    if (!bucket) throw new Error('Bucket name not configured');
    this.logger.debug(
      `getFile: fetching key='${fileName}' from bucket='${bucket}'`,
    );
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: fileName });
    try {
      const res = await this.s3Client.send(cmd);
      this.logger.log(
        `getFile: fetched key='${fileName}' from bucket='${bucket}'`,
      );
      return res.Body as unknown as Readable | undefined;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `getFile: failed to fetch key='${fileName}' from bucket='${bucket}': ${msg}`,
      );
      throw err;
    }
  }

  // List files in the bucket
  async listFiles(bucketName?: string) {
    const bucket = bucketName || this.bucketName;
    if (!bucket) throw new Error('Bucket name not configured');
    this.logger.debug(`listFiles: listing objects in bucket='${bucket}'`);
    const cmd = new ListObjectsV2Command({ Bucket: bucket });
    try {
      const res = await this.s3Client.send(cmd);
      const count = res.Contents ? res.Contents.length : 0;
      this.logger.log(
        `listFiles: found ${count} objects in bucket='${bucket}'`,
      );
      return res.Contents;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `listFiles: failed to list objects in bucket='${bucket}': ${msg}`,
      );
      throw err;
    }
  }

  // Delete a file
  async deleteFile(fileName: string, bucketName?: string): Promise<void> {
    const bucket = bucketName || this.bucketName;
    if (!bucket) throw new Error('Bucket name not configured');
    this.logger.debug(
      `deleteFile: deleting key='${fileName}' from bucket='${bucket}'`,
    );
    const cmd = new DeleteObjectCommand({ Bucket: bucket, Key: fileName });
    try {
      await this.s3Client.send(cmd);
      this.logger.log(
        `deleteFile: deleted key='${fileName}' from bucket='${bucket}'`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `deleteFile: failed to delete key='${fileName}' from bucket='${bucket}': ${msg}`,
      );
      throw err;
    }
  }
}
