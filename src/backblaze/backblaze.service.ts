import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { fetch } from 'undici';

interface BackblazeAuthorizationState {
  apiUrl: string;
  authorizationToken: string;
  downloadUrl: string;
  expiresAt: number;
}

interface UploadResult {
  fileId: string;
  fileName: string;
  publicUrl: string;
}

@Injectable()
export class BackblazeService implements OnModuleDestroy {
  private readonly logger = new Logger(BackblazeService.name);

  private readonly applicationKeyId?: string;
  private readonly applicationKey?: string;
  private readonly bucketId?: string;
  private readonly bucketName?: string;

  private authorizationState: BackblazeAuthorizationState | null = null;
  private readonly backoffBaseMs = 500;
  private readonly maxRetries = 3;

  constructor(private readonly configService: ConfigService) {
    this.applicationKeyId = this.configService.get<string>(
      'BACKBLAZE_APPLICATION_KEY_ID',
    );
    this.applicationKey = this.configService.get<string>(
      'BACKBLAZE_APPLICATION_KEY',
    );
    this.bucketId = this.configService.get<string>('BACKBLAZE_BUCKET_ID_PHOTOS');
    this.bucketName = this.configService.get<string>(
      'BACKBLAZE_BUCKET_NAME_PHOTOS',
    );

    if (this.isConfigured()) {
      this.logger.log('BackblazeService initialized with provided credentials.');
    } else {
      this.logger.warn(
        'BackblazeService initialized without full credentials. Uploads will be disabled until credentials are provided.',
      );
    }
  }

  onModuleDestroy(): void {
    this.authorizationState = null;
  }

  /**
   * Checks if the Backblaze configuration is present.
   */
  isConfigured(): boolean {
    return Boolean(
      this.applicationKeyId &&
        this.applicationKey &&
        this.bucketId &&
        this.bucketName,
    );
  }

  /**
   * Uploads a file buffer to Backblaze B2 storage with retry mechanism.
   */
  async uploadPhotoBuffer(
    buffer: Buffer,
    fileName: string,
    contentType: string,
  ): Promise<UploadResult> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Backblaze credentials are not configured.',
      );
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const { uploadUrl, authorizationToken } = await this.getUploadUrl();

        const sha1 = createHash('sha1').update(buffer).digest('hex');

        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: authorizationToken,
            'X-Bz-File-Name': encodeURIComponent(fileName),
            'Content-Type': contentType || 'b2/x-auto',
            'X-Bz-Content-Sha1': sha1,
          },
          body: buffer,
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(
            `Backblaze upload failed with status ${response.status}: ${errorBody}`,
          );
        }

        const result = (await response.json()) as {
          fileId: string;
          fileName: string;
        };

        const publicUrl = await this.buildPublicUrl(result.fileName);
        return {
          fileId: result.fileId,
          fileName: result.fileName,
          publicUrl,
        };
      } catch (error) {
        lastError = error;
        const delay = this.getBackoffDelay(attempt);
        this.logger.error(
          `Backblaze upload attempt ${attempt + 1} failed: ${
            (error as Error)?.message || error
          }. Retrying in ${delay}ms`,
        );
        if (attempt === this.maxRetries) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Unknown Backblaze upload error.');
  }

  /**
   * Deletes a file from Backblaze B2.
   */
  async deleteFile(fileId: string, fileName: string): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Backblaze delete requested but credentials are missing. Skipping.',
      );
      return;
    }

    const { apiUrl, authorizationToken } = await this.authorizeAccount();
    const endpoint = `${apiUrl}/b2api/v2/b2_delete_file_version`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: authorizationToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileId,
        fileName,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Backblaze delete failed with status ${response.status}: ${errorBody}`,
      );
    }
  }

  /**
   * Returns the public URL for a stored file.
   */
  async getPhotoPublicUrl(fileName: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Backblaze credentials are not configured.',
      );
    }

    return this.buildPublicUrl(fileName);
  }

  private async getUploadUrl(): Promise<{
    uploadUrl: string;
    authorizationToken: string;
  }> {
    const { apiUrl, authorizationToken } = await this.authorizeAccount();
    const endpoint = `${apiUrl}/b2api/v2/b2_get_upload_url`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: authorizationToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bucketId: this.bucketId }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Failed to get Backblaze upload URL (${response.status}): ${errorBody}`,
      );
    }

    const data = (await response.json()) as {
      uploadUrl: string;
      authorizationToken: string;
    };

    return data;
  }

  private async authorizeAccount(): Promise<BackblazeAuthorizationState> {
    const now = Date.now();
    if (this.authorizationState && this.authorizationState.expiresAt > now) {
      return this.authorizationState;
    }

    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Backblaze credentials are not configured.',
      );
    }

    const response = await fetch(
      'https://api.backblazeb2.com/b2api/v2/b2_authorize_account',
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${this.applicationKeyId}:${this.applicationKey}`,
          ).toString('base64')}`,
        },
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Backblaze authorization failed (${response.status}): ${errorBody}`,
      );
    }

    const data = (await response.json()) as {
      apiUrl: string;
      authorizationToken: string;
      downloadUrl: string;
      absoluteMinimumPartSize: number;
    };

    this.authorizationState = {
      apiUrl: data.apiUrl,
      authorizationToken: data.authorizationToken,
      downloadUrl: data.downloadUrl,
      expiresAt: Date.now() + 60 * 60 * 1000, // Refresh every hour
    };

    return this.authorizationState;
  }

  private getBackoffDelay(attempt: number): number {
    const jitter = Math.floor(Math.random() * 100);
    return Math.min(
      this.backoffBaseMs * Math.pow(2, attempt) + jitter,
      5000,
    );
  }

  private async buildPublicUrl(fileName: string): Promise<string> {
    const overrideUrl = this.configService.get<string>(
      'BACKBLAZE_PUBLIC_BASE_URL',
    );
    if (overrideUrl) {
      return `${overrideUrl.replace(/\/$/, '')}/${fileName}`;
    }

    const { downloadUrl } = await this.authorizeAccount();
    return `${downloadUrl}/file/${this.bucketName}/${fileName}`;
  }
}

export type BackblazeUploadResult = UploadResult;
