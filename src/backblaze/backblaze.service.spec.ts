import { BackblazeService } from './backblaze.service';
import { ConfigService } from '@nestjs/config';

jest.mock('undici', () => ({
  fetch: jest.fn(),
}));

const { fetch } = jest.requireMock('undici') as { fetch: jest.Mock };

function createResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  } as any;
}

describe('BackblazeService', () => {
  const config = new ConfigService({
    BACKBLAZE_APPLICATION_KEY_ID: 'app-key-id',
    BACKBLAZE_APPLICATION_KEY: 'app-key',
    BACKBLAZE_BUCKET_ID_PHOTOS: 'bucket-id',
    BACKBLAZE_BUCKET_NAME_PHOTOS: 'bucket-name',
    BACKBLAZE_PUBLIC_BASE_URL: 'https://cdn.example.com/photos',
  });

  beforeEach(() => {
    fetch.mockReset();
  });

  it('uploads a buffer and returns metadata', async () => {
    fetch
      .mockResolvedValueOnce(
        createResponse({
          apiUrl: 'https://api.backblaze.com',
          authorizationToken: 'auth-token',
          downloadUrl: 'https://download.backblaze.com',
          absoluteMinimumPartSize: 1000000,
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          uploadUrl: 'https://upload.backblaze.com/file',
          authorizationToken: 'upload-token',
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          fileId: 'file-id',
          fileName: 'inspection-photos/2025/01/file.jpg',
        }),
      );

    const service = new BackblazeService(config);
    const result = await service.uploadPhotoBuffer(
      Buffer.from('test-data'),
      'inspection-photos/2025/01/file.jpg',
      'image/jpeg',
    );

    expect(result.fileId).toEqual('file-id');
    expect(result.publicUrl).toEqual(
      'https://cdn.example.com/photos/inspection-photos/2025/01/file.jpg',
    );
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('deletes a file by calling Backblaze API', async () => {
    fetch
      .mockResolvedValueOnce(
        createResponse({
          apiUrl: 'https://api.backblaze.com',
          authorizationToken: 'auth-token',
          downloadUrl: 'https://download.backblaze.com',
          absoluteMinimumPartSize: 1000000,
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          uploadUrl: 'https://upload.backblaze.com/file',
          authorizationToken: 'upload-token',
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          fileId: 'file-id',
          fileName: 'inspection-photos/2025/01/file.jpg',
        }),
      )
      .mockResolvedValueOnce(createResponse({}));

    const service = new BackblazeService(config);
    await service.uploadPhotoBuffer(
      Buffer.from('test-data'),
      'inspection-photos/2025/01/file.jpg',
      'image/jpeg',
    );

    await expect(
      service.deleteFile('file-id', 'inspection-photos/2025/01/file.jpg'),
    ).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(4);
  });
});
