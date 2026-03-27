/*
 * --------------------------------------------------------------------------
 * File: file-validation.pipe.spec.ts
 * --------------------------------------------------------------------------
 */

import { FileValidationPipe } from './file-validation.pipe';

// Mock fs/promises to avoid actual filesystem operations
jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(Buffer.from('fake')),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

// fileTypeFromBuffer mock — used by the eval-intercepted import
const mockFileTypeFromBuffer = jest
  .fn()
  .mockResolvedValue({ mime: 'image/png', ext: 'png' });

// Override eval globally to intercept the dynamic import('file-type') inside the pipe.
// jest.mock('file-type', ...) cannot work here because file-type is an ESM-only package
// not present in node_modules; we intercept at the eval() call site instead.
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

function makeFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'test.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 1024,
    destination: '/tmp',
    filename: 'test.png',
    path: '/tmp/test.png',
    buffer: Buffer.from('fake'),
    stream: null as any,
    ...overrides,
  };
}

describe('FileValidationPipe', () => {
  let pipe: FileValidationPipe;

  beforeEach(() => {
    pipe = new FileValidationPipe();
    mockFileTypeFromBuffer.mockResolvedValue({ mime: 'image/png', ext: 'png' });
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should throw BadRequestException when no file provided (null)', async () => {
    await expect(pipe.transform(null as any, {} as any)).rejects.toThrow(
      /File upload is required/,
    );
  });

  it('should throw BadRequestException when empty array provided', async () => {
    await expect(pipe.transform([] as any, {} as any)).rejects.toThrow(
      /At least one file must be uploaded/,
    );
  });

  it('should return single valid file unchanged', async () => {
    const file = makeFile();
    const result = await pipe.transform(file, {} as any);
    expect(result).toBe(file);
  });

  it('should return array of valid files unchanged', async () => {
    const files = [
      makeFile(),
      makeFile({ originalname: 'other.jpg', mimetype: 'image/jpeg' }),
    ];
    mockFileTypeFromBuffer
      .mockResolvedValueOnce({ mime: 'image/png', ext: 'png' })
      .mockResolvedValueOnce({ mime: 'image/jpeg', ext: 'jpg' });
    const result = await pipe.transform(files, {} as any);
    expect(result).toBe(files);
  });

  it('should skip validation for S3 files (file with .location)', async () => {
    const s3File = makeFile();
    (s3File as any).location = 'https://s3.example.com/file.png';
    const result = await pipe.transform(s3File, {} as any);
    expect(result).toBe(s3File);
  });

  it('should throw BadRequestException when file exceeds 5MB', async () => {
    const bigFile = makeFile({ size: 6 * 1024 * 1024 }); // 6MB
    await expect(pipe.transform(bigFile, {} as any)).rejects.toThrow(
      /exceeds the size limit/,
    );
  });

  it('should throw BadRequestException for invalid mimetype', async () => {
    const pdfFile = makeFile({
      mimetype: 'application/pdf',
      originalname: 'doc.pdf',
    });
    await expect(pipe.transform(pdfFile, {} as any)).rejects.toThrow(
      /invalid type/,
    );
  });

  it('should throw BadRequestException for invalid extension (despite valid mimetype)', async () => {
    const weirdFile = makeFile({
      originalname: 'file.bmp',
      mimetype: 'image/png',
    });
    await expect(pipe.transform(weirdFile, {} as any)).rejects.toThrow(
      /invalid type/,
    );
  });

  it('should throw BadRequestException when magic number does not match extension', async () => {
    mockFileTypeFromBuffer.mockResolvedValueOnce({
      mime: 'application/pdf',
      ext: 'pdf',
    });
    const file = makeFile();
    await expect(pipe.transform(file, {} as any)).rejects.toThrow(
      /does not match its extension/,
    );
  });

  it('should throw BadRequestException when fileTypeFromBuffer returns null', async () => {
    mockFileTypeFromBuffer.mockResolvedValueOnce(null);
    const file = makeFile();
    await expect(pipe.transform(file, {} as any)).rejects.toThrow(
      /does not match its extension/,
    );
  });

  it('should throw InternalServerErrorException when readFile throws unexpected error', async () => {
    const fsPromises = require('fs/promises');
    (fsPromises.readFile as jest.Mock).mockRejectedValueOnce(
      new Error('Disk error'),
    );
    const file = makeFile();
    await expect(pipe.transform(file, {} as any)).rejects.toThrow(
      /Could not validate file type/,
    );
    // Restore default
    (fsPromises.readFile as jest.Mock).mockResolvedValue(Buffer.from('fake'));
  });
});
