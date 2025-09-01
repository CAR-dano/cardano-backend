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

    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await this.s3Client.send(cmd);

    // Construct a public URL. Backblaze can expose files under a public bucket URL.
    // The exact public host may differ by account; we build a reasonable URL from STORAGE_ENDPOINT.
    const endpoint = (this.endpoint || '')
      .replace(/^http:\/\//, 'https://')
      .replace(/\/$/, '');
    // Many Backblaze public URLs follow /file/{bucket}/{key}
    return `${endpoint}/file/${bucket}/${encodeURIComponent(key)}`;
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

    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.s3Client.send(cmd);

    const endpoint = (this.endpoint || '')
      .replace(/^http:\/\//, 'https://')
      .replace(/\/$/, '');
    return `${endpoint}/file/${bucket}/${encodeURIComponent(key)}`;
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
    return this.uploadBuffer(buffer, key, 'application/pdf', bucketName);
  }

  // Get an object stream from Backblaze
  async getFile(
    fileName: string,
    bucketName?: string,
  ): Promise<Readable | undefined> {
    const bucket = bucketName || this.bucketName;
    if (!bucket) throw new Error('Bucket name not configured');

    const cmd = new GetObjectCommand({ Bucket: bucket, Key: fileName });
    const res = await this.s3Client.send(cmd);
    // response.Body is a stream in Node.js runtimes
    return res.Body as unknown as Readable | undefined;
  }

  // List files in the bucket
  async listFiles(bucketName?: string) {
    const bucket = bucketName || this.bucketName;
    if (!bucket) throw new Error('Bucket name not configured');

    const cmd = new ListObjectsV2Command({ Bucket: bucket });
    const res = await this.s3Client.send(cmd);
    return res.Contents;
  }

  // Delete a file
  async deleteFile(fileName: string, bucketName?: string): Promise<void> {
    const bucket = bucketName || this.bucketName;
    if (!bucket) throw new Error('Bucket name not configured');

    const cmd = new DeleteObjectCommand({ Bucket: bucket, Key: fileName });
    await this.s3Client.send(cmd);
  }
}
