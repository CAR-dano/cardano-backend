/*
 * --------------------------------------------------------------------------
 * File: scalar-docs.controller.spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Unit tests for ScalarDocsController
 * --------------------------------------------------------------------------
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ScalarDocsController } from './scalar-docs.controller';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, InternalServerErrorException } from '@nestjs/common';

// Mock path and fs modules
jest.mock('path', () => ({
  join: jest.fn().mockReturnValue('/mocked/path/scalar-docs.html'),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

// Mock the getOpenApiDocument import from main
jest.mock('../main', () => ({
  getOpenApiDocument: jest.fn(),
}));

import * as fs from 'fs';
import { getOpenApiDocument } from '../main';

const mockFsExistsSync = fs.existsSync as jest.Mock;
const mockGetOpenApiDocument = getOpenApiDocument as jest.Mock;

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ScalarDocsController', () => {
  let controller: ScalarDocsController;
  let configService: { get: jest.Mock };

  function buildModule(nodeEnv: string | undefined = 'development') {
    configService = { get: jest.fn().mockReturnValue(nodeEnv) };
    return Test.createTestingModule({
      controllers: [ScalarDocsController],
      providers: [
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', async () => {
    const module: TestingModule = await buildModule();
    controller = module.get<ScalarDocsController>(ScalarDocsController);
    expect(controller).toBeDefined();
  });

  // -------------------------------------------------------------------------
  describe('getOpenApiSpec', () => {
    it('should return the OpenAPI document when available in development', async () => {
      const module: TestingModule = await buildModule('development');
      controller = module.get<ScalarDocsController>(ScalarDocsController);

      const mockDoc = { openapi: '3.0.0', info: { title: 'Test API', version: '1.0' } };
      mockGetOpenApiDocument.mockReturnValue(mockDoc);

      const result = controller.getOpenApiSpec();

      expect(result).toEqual(mockDoc);
    });

    it('should throw NotFoundException when NODE_ENV is production', async () => {
      const module: TestingModule = await buildModule('production');
      controller = module.get<ScalarDocsController>(ScalarDocsController);

      expect(() => controller.getOpenApiSpec()).toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException when document is not yet generated', async () => {
      const module: TestingModule = await buildModule('development');
      controller = module.get<ScalarDocsController>(ScalarDocsController);

      mockGetOpenApiDocument.mockReturnValue(null);

      expect(() => controller.getOpenApiSpec()).toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException when document is undefined', async () => {
      const module: TestingModule = await buildModule('development');
      controller = module.get<ScalarDocsController>(ScalarDocsController);

      mockGetOpenApiDocument.mockReturnValue(undefined);

      expect(() => controller.getOpenApiSpec()).toThrow(InternalServerErrorException);
    });
  });

  // -------------------------------------------------------------------------
  describe('getScalarDocs', () => {
    let mockRes: {
      sendFile: jest.Mock;
      status: jest.Mock;
      send: jest.Mock;
      headersSent: boolean;
    };

    beforeEach(() => {
      mockRes = {
        sendFile: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        headersSent: false,
      };
    });

    it('should throw NotFoundException when NODE_ENV is production', async () => {
      const module: TestingModule = await buildModule('production');
      controller = module.get<ScalarDocsController>(ScalarDocsController);

      expect(() => controller.getScalarDocs(mockRes as any)).toThrow(NotFoundException);
    });

    it('should call res.sendFile when HTML file exists', async () => {
      const module: TestingModule = await buildModule('development');
      controller = module.get<ScalarDocsController>(ScalarDocsController);

      mockFsExistsSync.mockReturnValue(true);

      controller.getScalarDocs(mockRes as any);

      expect(mockRes.sendFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
      );
    });

    it('should send 500 when HTML file does not exist', async () => {
      const module: TestingModule = await buildModule('development');
      controller = module.get<ScalarDocsController>(ScalarDocsController);

      mockFsExistsSync.mockReturnValue(false);
      mockRes.headersSent = false;

      controller.getScalarDocs(mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith('Could not load API documentation.');
    });

    it('should not send again if headers already sent when file not found', async () => {
      const module: TestingModule = await buildModule('development');
      controller = module.get<ScalarDocsController>(ScalarDocsController);

      mockFsExistsSync.mockReturnValue(false);
      mockRes.headersSent = true;

      controller.getScalarDocs(mockRes as any);

      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should call sendFile callback without error when file sends successfully', async () => {
      const module: TestingModule = await buildModule('development');
      controller = module.get<ScalarDocsController>(ScalarDocsController);

      mockFsExistsSync.mockReturnValue(true);
      // sendFile calls callback with no error (success)
      mockRes.sendFile.mockImplementation((_path: string, cb: (err?: Error) => void) => {
        cb(undefined);
      });

      // Should not throw
      expect(() => controller.getScalarDocs(mockRes as any)).not.toThrow();
    });

    it('should handle sendFile error and throw NotFoundException when headers not sent', async () => {
      const module: TestingModule = await buildModule('development');
      controller = module.get<ScalarDocsController>(ScalarDocsController);

      mockFsExistsSync.mockReturnValue(true);
      mockRes.headersSent = false;
      const sendFileError = new Error('ENOENT: file not found');
      mockRes.sendFile.mockImplementation((_path: string, cb: (err?: Error) => void) => {
        cb(sendFileError);
      });

      // The inner callback throws NotFoundException, which bubbles up through outer catch
      // and then sends 500 response (since headersSent is false)
      controller.getScalarDocs(mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith('Could not load API documentation.');
    });

    it('should not send response when sendFile errors but headers already sent', async () => {
      const module: TestingModule = await buildModule('development');
      controller = module.get<ScalarDocsController>(ScalarDocsController);

      mockFsExistsSync.mockReturnValue(true);
      const sendFileError = new Error('send error');

      // headers already sent before sendFile callback fires
      mockRes.sendFile.mockImplementation((_path: string, cb: (err?: Error) => void) => {
        mockRes.headersSent = true;
        cb(sendFileError);
      });

      controller.getScalarDocs(mockRes as any);

      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });
});
