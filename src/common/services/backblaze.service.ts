import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  HeadBucketCommand,
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
    // Normalize endpoint: ensure it contains a protocol so the SDK can connect properly.
    const rawEndpoint = this.config.get<string>('STORAGE_ENDPOINT');
    if (rawEndpoint && !/^https?:\/\//i.test(rawEndpoint)) {
      this.endpoint = `https://${rawEndpoint.replace(/\/$/, '')}`;
    } else if (rawEndpoint) {
      this.endpoint = rawEndpoint.replace(/\/$/, '');
    } else {
      this.endpoint = undefined;
    }
    this.bucketName = this.config.get<string>('STORAGE_BUCKET_NAME');

    if (!accessKeyId || !secretAccessKey) {
      this.logger.warn(
        'Backblaze credentials (STORAGE_APPLICATION_KEY_ID / STORAGE_APPLICATION_KEY) are not set',
      );
    }

    this.logger.debug(
      `BackblazeService constructor: endpoint=${this.endpoint ?? 'N/A'}, bucket=${this.bucketName ?? 'N/A'}, region=${region ?? 'N/A'}`,
    );

    // Optionally use a node HTTP handler (if available) with a modest connection
    // timeout. We require it dynamically so the package remains optional.
    let requestHandler: any = undefined;
    try {
      const nh = require('@aws-sdk/node-http-handler');
      if (nh && typeof nh.NodeHttpHandler === 'function') {
        // increase timeouts: 20s connect, 60s socket
        requestHandler = new nh.NodeHttpHandler({
          connectionTimeout: 20_000,
          socketTimeout: 60_000,
        });
      }
    } catch (e) {
      // package not installed; proceed without a custom handler
      this.logger.debug(
        `BackblazeService: node-http-handler not available: ${String(e)}`,
      );
    }

    this.s3Client = new S3Client({
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
      endpoint: this.endpoint || undefined,
      region: region || undefined,
      forcePathStyle: true,
      // Increase built-in AWS SDK retry attempts a bit
      maxAttempts: 6,
      ...(requestHandler ? { requestHandler } : {}),
    });
  }

  // Helper to stringify errors for better logs
  private formatError(err: unknown): string {
    if (err instanceof Error) {
      const anyErr = err as any;
      const parts = [
        `name=${anyErr.name ?? 'Error'}`,
        `message=${anyErr.message ?? ''}`,
      ];
      if (anyErr.code) parts.push(`code=${String(anyErr.code)}`);
      if (anyErr.stack) parts.push(`stack=${anyErr.stack.split('\n')[0]}`);
      try {
        // include other enumerable properties (like $metadata)
        const extra = Object.keys(anyErr)
          .filter((k) => !['name', 'message', 'stack'].includes(k))
          .reduce((acc: any, k) => ({ ...acc, [k]: anyErr[k] }), {});
        if (Object.keys(extra).length)
          parts.push(`extra=${JSON.stringify(extra)}`);
      } catch (_) {
        // ignore
      }
      return parts.join(' ');
    }
    try {
      return JSON.stringify(err);
    } catch (_) {
      return String(err);
    }
  }

  // Wrapper to send S3 commands with retries for transient network errors
  private async sendCommand(cmd: unknown, maxAttempts = 3): Promise<any> {
    let attempt = 0;
    let lastErr: unknown;
    while (attempt < maxAttempts) {
      try {
        attempt++;
        if (attempt > 1)
          this.logger.debug(
            `sendCommand: retry attempt ${attempt} for ${(cmd as any)?.constructor?.name ?? 'command'}`,
          );
        return await this.s3Client.send(cmd as any);
      } catch (err: unknown) {
        lastErr = err;
        const code = ((err as any)?.code ?? (err as any)?.name ?? '') as string;
        // For network/timeouts, wait and retry; otherwise break
        if (
          typeof code === 'string' &&
          /ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN/i.test(code) &&
          attempt < maxAttempts
        ) {
          const backoff = Math.pow(2, attempt) * 500; // 500ms, 1000ms, 2000ms...
          this.logger.warn(
            `sendCommand: transient network error (${String(code)}), backing off ${backoff}ms and retrying (${attempt}/${maxAttempts})`,
          );
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        // Non-transient or out of attempts
        this.logger.error(
          `sendCommand: failed after ${attempt} attempt(s): ${this.formatError(err)}`,
        );
        throw err;
      }
    }
    throw lastErr;
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
      await this.sendCommand(cmd);
      this.logger.log(
        `uploadFile: successfully uploaded '${key}' to bucket '${bucket}'`,
      );
    } catch (err: unknown) {
      this.logger.error(
        `uploadFile: failed to upload '${key}' to bucket '${bucket}': ${this.formatError(err)}`,
      );
      throw err;
    }

  // Construct a public URL using STORAGE_FILE_ENDPOINT or fallback to default Backblaze file endpoint.
  const fileEndpoint = this.config.get<string>('STORAGE_FILE_ENDPOINT') || `https://f005.backblazeb2.com`;
  const publicUrl = `${fileEndpoint}/file/${bucket}/${encodeURIComponent(key)}`;
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
      await this.sendCommand(cmd);
      this.logger.log(
        `uploadBuffer: successfully uploaded '${key}' to bucket '${bucket}'`,
      );
    } catch (err: unknown) {
      this.logger.error(
        `uploadBuffer: failed to upload '${key}' to bucket '${bucket}': ${this.formatError(err)}`,
      );
      throw err;
    }

  const fileEndpoint = this.config.get<string>('STORAGE_FILE_ENDPOINT') || `https://f005.backblazeb2.com`;
  const publicUrl = `${fileEndpoint}/file/${bucket}/${encodeURIComponent(key)}`;
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
      this.logger.error(
        `uploadPdfBuffer: failed to upload pdf '${filename}': ${this.formatError(err)}`,
      );
      throw err;
    }
  }

  /**
   * Upload an image buffer to `uploads/inspection-photos/{filename}` and return the public URL.
   * Accepts common image MIME types; defaults to application/octet-stream if unknown.
   */
  async uploadImageBuffer(
    buffer: Buffer,
    filename: string,
    contentType: string = 'application/octet-stream',
    bucketName?: string,
  ): Promise<string> {
    const key = `uploads/inspection-photos/${filename}`;
    this.logger.debug(
      `uploadImageBuffer: uploading image '${filename}' as key='${key}' (ct=${contentType})`,
    );
    try {
      const url = await this.uploadBuffer(buffer, key, contentType, bucketName);
      this.logger.log(
        `uploadImageBuffer: uploaded image '${filename}' => ${url}`,
      );
      return url;
    } catch (err: unknown) {
      this.logger.error(
        `uploadImageBuffer: failed to upload image '${filename}': ${this.formatError(err)}`,
      );
      throw err;
    }
  }

  /**
   * Batch upload image buffers. Returns an array of public URLs in the same order.
   */
  async uploadImageBuffers(
    items: { buffer: Buffer; filename: string; contentType?: string }[],
    bucketName?: string,
  ): Promise<string[]> {
    const results: string[] = [];
    for (const item of items) {
      const ct = item.contentType || 'application/octet-stream';
      const url = await this.uploadImageBuffer(
        item.buffer,
        item.filename,
        ct,
        bucketName,
      );
      results.push(url);
    }
    return results;
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
      const res = await this.sendCommand(cmd);
      this.logger.log(
        `getFile: fetched key='${fileName}' from bucket='${bucket}'`,
      );
      return res.Body as unknown as Readable | undefined;
    } catch (err: unknown) {
      this.logger.error(
        `getFile: failed to fetch key='${fileName}' from bucket='${bucket}': ${this.formatError(err)}`,
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
      const res = await this.sendCommand(cmd);
      const count = res.Contents ? res.Contents.length : 0;
      this.logger.log(
        `listFiles: found ${count} objects in bucket='${bucket}'`,
      );
      return res.Contents;
    } catch (err: unknown) {
      this.logger.error(
        `listFiles: failed to list objects in bucket='${bucket}': ${this.formatError(err)}`,
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
      await this.sendCommand(cmd);
      this.logger.log(
        `deleteFile: deleted key='${fileName}' from bucket='${bucket}'`,
      );
    } catch (err: unknown) {
      this.logger.error(
        `deleteFile: failed to delete key='${fileName}' from bucket='${bucket}': ${this.formatError(err)}`,
      );
      throw err;
    }
  }

  /**
   * Perform a lightweight connectivity check against the configured bucket.
   * Uses S3 HeadBucket to verify bucket exists and credentials are valid.
   */
  async headBucket(bucketName?: string): Promise<{
    ok: boolean;
    bucket?: string;
    endpoint?: string;
    error?: string;
  }> {
    const bucket = bucketName || this.bucketName;
    try {
      if (!bucket) throw new Error('Bucket name not configured');
      const cmd = new HeadBucketCommand({ Bucket: bucket });
      await this.sendCommand(cmd);
      return { ok: true, bucket, endpoint: this.endpoint };
    } catch (err: unknown) {
      const msg = this.formatError(err);
      this.logger.error(`headBucket: failed: ${msg}`);
      return { ok: false, bucket, endpoint: this.endpoint, error: msg };
    }
  }
}
