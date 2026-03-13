/*
 * --------------------------------------------------------------------------
 * File: optional-file-validation.pipe.spec.ts
 * --------------------------------------------------------------------------
 */
import { BadRequestException } from '@nestjs/common';
import { OptionalFileValidationPipe } from './optional-file-validation.pipe';

jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(Buffer.from('fake')),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

// fileTypeFromBuffer mock — used by the eval-intercepted import
const mockFileTypeFromBuffer = jest.fn().mockResolvedValue({ mime: 'image/png', ext: 'png' });

// Override eval globally to intercept the dynamic import('file-type') inside the pipe.
// jest.mock('file-type', ...) cannot work here because file-type is ESM-only.
const originalEval = global.eval;
beforeAll(() => {
  (global as any).eval = (str: string) => {
    if (typeof str === 'string' && str.includes('file-type')) {
      return Promise.resolve({ fileTypeFromBuffer: mockFileTypeFromBuffer });
    }
    return originalEval(str);
  };
});
afterAll(() => {
  (global as any).eval = originalEval;
});

function makeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'photo.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 1024,
    destination: '/tmp',
    filename: 'photo.png',
    path: '/tmp/photo.png',
    buffer: Buffer.from('fake'),
    stream: null as any,
    ...overrides,
  };
}

describe('OptionalFileValidationPipe', () => {
  let pipe: OptionalFileValidationPipe;

  beforeEach(() => {
    pipe = new OptionalFileValidationPipe();
    mockFileTypeFromBuffer.mockResolvedValue({ mime: 'image/png', ext: 'png' });
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should return undefined when no file is provided', async () => {
    const result = await pipe.transform(undefined, {} as any);
    expect(result).toBeUndefined();
  });

  it('should return the file when it is valid', async () => {
    const file = makeFile();
    const result = await pipe.transform(file, {} as any);
    expect(result).toBe(file);
  });

  it('should skip validation for S3 files', async () => {
    const s3File = makeFile();
    (s3File as any).location = 'https://s3.example.com/file.png';
    const result = await pipe.transform(s3File, {} as any);
    expect(result).toBe(s3File);
  });

  it('should throw BadRequestException when file exceeds 5MB', async () => {
    const bigFile = makeFile({ size: 6 * 1024 * 1024 });
    await expect(pipe.transform(bigFile, {} as any)).rejects.toThrow(
      /exceeds the size limit/,
    );
  });

  it('should throw BadRequestException for invalid mimetype', async () => {
    const pdfFile = makeFile({ mimetype: 'application/pdf', originalname: 'doc.pdf' });
    await expect(pipe.transform(pdfFile, {} as any)).rejects.toThrow(
      /invalid type/,
    );
  });

  it('should throw BadRequestException for invalid extension', async () => {
    const bmpFile = makeFile({ originalname: 'image.bmp', mimetype: 'image/png' });
    await expect(pipe.transform(bmpFile, {} as any)).rejects.toThrow(
      /invalid type/,
    );
  });

  it('should throw BadRequestException when file type does not match buffer content', async () => {
    mockFileTypeFromBuffer.mockResolvedValueOnce({ mime: 'application/pdf', ext: 'pdf' });
    const file = makeFile({ buffer: Buffer.from('fake pdf') });
    await expect(pipe.transform(file, {} as any)).rejects.toThrow(
      /does not match its extension/,
    );
  });

  it('should throw BadRequestException when fileTypeFromBuffer returns null', async () => {
    mockFileTypeFromBuffer.mockResolvedValueOnce(null);
    const file = makeFile({ buffer: Buffer.from('unknown') });
    await expect(pipe.transform(file, {} as any)).rejects.toThrow(
      /does not match its extension/,
    );
  });

  it('should use path-based readFile when buffer is not present', async () => {
    const file = makeFile({ buffer: undefined as any, path: '/tmp/photo.png' });
    const result = await pipe.transform(file, {} as any);
    expect(result).toBe(file);
  });

  it('should throw BadRequestException when neither buffer nor path is present', async () => {
    const file = makeFile({ buffer: undefined as any, path: undefined });
    await expect(pipe.transform(file, {} as any)).rejects.toThrow(
      /File buffer is missing/,
    );
  });
});
