/*
 * --------------------------------------------------------------------------
 * File: all-exceptions.filter.spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Unit tests for AllExceptionsFilter.
 * Validates that ALL exception types produce the standardized error format:
 *   { statusCode, message[], error, errorCode, path, timestamp }
 * --------------------------------------------------------------------------
 */

import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import {
  AllExceptionsFilter,
  StandardErrorResponse,
} from './all-exceptions.filter';
import { AppError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes.enum';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockResponse: {
    status: jest.Mock;
    json: jest.Mock;
  };
  let mockRequest: { url: string };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = { url: '/api/v1/test' };

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as unknown as ArgumentsHost;
  });

  // ─── Helper ────────────────────────────────────────────────────
  function getResponseBody(): StandardErrorResponse {
    return mockResponse.json.mock.calls[0][0];
  }

  // ─── Common shape validation ───────────────────────────────────
  function expectStandardShape(body: StandardErrorResponse) {
    expect(body).toHaveProperty('statusCode');
    expect(body).toHaveProperty('message');
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('errorCode');
    expect(body).toHaveProperty('path');
    expect(body).toHaveProperty('timestamp');

    expect(typeof body.statusCode).toBe('number');
    expect(Array.isArray(body.message)).toBe(true);
    expect(typeof body.error).toBe('string');
    expect(typeof body.errorCode).toBe('string');
    expect(typeof body.path).toBe('string');
    expect(typeof body.timestamp).toBe('string');

    // Timestamp should be a valid ISO string
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);

    // Path should match request URL
    expect(body.path).toBe('/api/v1/test');
  }

  // ═══════════════════════════════════════════════════════════════
  // 1. AppError handling
  // ═══════════════════════════════════════════════════════════════
  describe('AppError handling', () => {
    it('should handle AppError with correct statusCode and errorCode', () => {
      const error = new AppError(
        'Inspection not found',
        ErrorCode.INSPECTION_NOT_FOUND,
        404,
      );

      filter.catch(error, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);

      const body = getResponseBody();
      expectStandardShape(body);
      expect(body.statusCode).toBe(404);
      expect(body.message).toEqual(['Inspection not found']);
      expect(body.error).toBe('Not Found');
      expect(body.errorCode).toBe(ErrorCode.INSPECTION_NOT_FOUND);
    });

    it('should handle AppError with default 500 status', () => {
      const error = new AppError(
        'PDF generation failed',
        ErrorCode.PDF_GENERATION_FAILED,
      );

      filter.catch(error, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);

      const body = getResponseBody();
      expectStandardShape(body);
      expect(body.statusCode).toBe(500);
      expect(body.errorCode).toBe(ErrorCode.PDF_GENERATION_FAILED);
      expect(body.error).toBe('Internal Server Error');
    });

    it('should handle AppError with 409 Conflict', () => {
      const error = new AppError(
        'Email already registered',
        ErrorCode.USER_EMAIL_CONFLICT,
        409,
      );

      filter.catch(error, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(409);

      const body = getResponseBody();
      expectStandardShape(body);
      expect(body.statusCode).toBe(409);
      expect(body.errorCode).toBe(ErrorCode.USER_EMAIL_CONFLICT);
      expect(body.error).toBe('Conflict');
    });

    it('should handle AppError with 400 Bad Request', () => {
      const error = new AppError(
        'Invalid date format',
        ErrorCode.INSPECTION_INVALID_DATE,
        400,
      );

      filter.catch(error, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);

      const body = getResponseBody();
      expectStandardShape(body);
      expect(body.statusCode).toBe(400);
      expect(body.errorCode).toBe(ErrorCode.INSPECTION_INVALID_DATE);
      expect(body.error).toBe('Bad Request');
    });

    it('should handle AppError with details (details not leaked to response)', () => {
      const error = new AppError(
        'Database query failed',
        ErrorCode.DATABASE_ERROR,
        500,
        { query: 'SELECT *', duration: 30000 },
      );

      filter.catch(error, mockHost);

      const body = getResponseBody();
      expectStandardShape(body);
      // Details should NOT be in the response (security: don't leak internals)
      expect(body).not.toHaveProperty('details');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. HttpException handling (NestJS built-in)
  // ═══════════════════════════════════════════════════════════════
  describe('HttpException handling', () => {
    it('should handle simple HttpException with string message', () => {
      const error = new HttpException(
        'Resource not found',
        HttpStatus.NOT_FOUND,
      );

      filter.catch(error, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);

      const body = getResponseBody();
      expectStandardShape(body);
      expect(body.statusCode).toBe(404);
      expect(body.message).toEqual(['Resource not found']);
      expect(body.errorCode).toBe(ErrorCode.NOT_FOUND);
    });

    it('should handle HttpException with object response (ValidationPipe format)', () => {
      const error = new HttpException(
        {
          statusCode: 400,
          message: ['field1 must be a string', 'field2 is required'],
          error: 'Bad Request',
        },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(error, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);

      const body = getResponseBody();
      expectStandardShape(body);
      expect(body.statusCode).toBe(400);
      expect(body.message).toEqual([
        'field1 must be a string',
        'field2 is required',
      ]);
      expect(body.error).toBe('Bad Request');
      expect(body.errorCode).toBe(ErrorCode.BAD_REQUEST);
    });

    it('should handle 401 Unauthorized', () => {
      const error = new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

      filter.catch(error, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(401);

      const body = getResponseBody();
      expectStandardShape(body);
      expect(body.errorCode).toBe(ErrorCode.UNAUTHORIZED);
      expect(body.error).toBe('Unauthorized');
    });

    it('should handle 403 Forbidden', () => {
      const error = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

      filter.catch(error, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(403);

      const body = getResponseBody();
      expectStandardShape(body);
      expect(body.errorCode).toBe(ErrorCode.FORBIDDEN);
    });

    it('should handle 409 Conflict', () => {
      const error = new HttpException(
        { message: 'Duplicate entry', error: 'Conflict', statusCode: 409 },
        HttpStatus.CONFLICT,
      );

      filter.catch(error, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(409);

      const body = getResponseBody();
      expectStandardShape(body);
      expect(body.errorCode).toBe(ErrorCode.CONFLICT);
      expect(body.error).toBe('Conflict');
    });

    it('should handle 429 Too Many Requests (throttle)', () => {
      const error = new HttpException(
        { message: 'ThrottlerException: Too Many Requests', statusCode: 429 },
        HttpStatus.TOO_MANY_REQUESTS,
      );

      filter.catch(error, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(429);

      const body = getResponseBody();
      expectStandardShape(body);
      expect(body.errorCode).toBe(ErrorCode.TOO_MANY_REQUESTS);
    });

    it('should handle HttpException with single string message in object', () => {
      const error = new HttpException(
        {
          message: 'Single error message',
          error: 'Bad Request',
          statusCode: 400,
        },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(error, mockHost);

      const body = getResponseBody();
      expectStandardShape(body);
      expect(body.message).toEqual(['Single error message']);
    });

    it('should handle HttpException with no message property in object', () => {
      const error = new HttpException(
        { error: 'Not Found', statusCode: 404 },
        HttpStatus.NOT_FOUND,
      );

      filter.catch(error, mockHost);

      const body = getResponseBody();
      expectStandardShape(body);
      expect(body.message).toEqual(['An error occurred']);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. Unknown / unhandled exception handling
  // ═══════════════════════════════════════════════════════════════
  describe('Unknown exception handling', () => {
    it('should handle plain Error (raw throw new Error)', () => {
      const error = new Error('Something went very wrong');

      filter.catch(error, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);

      const body = getResponseBody();
      expectStandardShape(body);
      expect(body.statusCode).toBe(500);
      expect(body.message).toEqual(['An unexpected error occurred']);
      expect(body.error).toBe('Internal Server Error');
      expect(body.errorCode).toBe(ErrorCode.INTERNAL_ERROR);
    });

    it('should handle string exception', () => {
      filter.catch('random string error', mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);

      const body = getResponseBody();
      expectStandardShape(body);
      expect(body.statusCode).toBe(500);
      expect(body.message).toEqual(['An unexpected error occurred']);
      expect(body.errorCode).toBe(ErrorCode.INTERNAL_ERROR);
    });

    it('should handle null/undefined exception', () => {
      filter.catch(null, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);

      const body = getResponseBody();
      expectStandardShape(body);
      expect(body.message).toEqual(['An unexpected error occurred']);
    });

    it('should handle object exception (non-Error, non-HttpException)', () => {
      filter.catch({ foo: 'bar' }, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);

      const body = getResponseBody();
      expectStandardShape(body);
      expect(body.statusCode).toBe(500);
      expect(body.errorCode).toBe(ErrorCode.INTERNAL_ERROR);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. Logging behavior
  // ═══════════════════════════════════════════════════════════════
  describe('Logging behavior', () => {
    let loggerErrorSpy: jest.SpyInstance;
    let loggerWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      loggerErrorSpy = jest
        .spyOn((filter as any).logger, 'error')
        .mockImplementation();
      loggerWarnSpy = jest
        .spyOn((filter as any).logger, 'warn')
        .mockImplementation();
    });

    afterEach(() => {
      loggerErrorSpy.mockRestore();
      loggerWarnSpy.mockRestore();
    });

    it('should log 5xx errors at error level with stack trace', () => {
      const error = new AppError(
        'Internal failure',
        ErrorCode.INTERNAL_ERROR,
        500,
      );

      filter.catch(error, mockHost);

      expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
      expect(loggerWarnSpy).not.toHaveBeenCalled();

      // Check that stack trace is passed as second argument
      const stackArg = loggerErrorSpy.mock.calls[0][1];
      expect(stackArg).toBeDefined();
      expect(stackArg).toContain('AppError');
    });

    it('should log 4xx errors at warn level without stack trace', () => {
      const error = new AppError('Not found', ErrorCode.NOT_FOUND, 404);

      filter.catch(error, mockHost);

      expect(loggerWarnSpy).toHaveBeenCalledTimes(1);
      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });

    it('should log unknown errors at error level', () => {
      const error = new Error('Unexpected crash');

      filter.catch(error, mockHost);

      expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
      expect(loggerWarnSpy).not.toHaveBeenCalled();
    });

    it('should include errorCode and path in log message', () => {
      const error = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

      filter.catch(error, mockHost);

      const logMessage = loggerWarnSpy.mock.calls[0][0];
      expect(logMessage).toContain(ErrorCode.FORBIDDEN);
      expect(logMessage).toContain('/api/v1/test');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 5. Path and timestamp
  // ═══════════════════════════════════════════════════════════════
  describe('Path and timestamp', () => {
    it('should use request URL as path', () => {
      mockRequest.url = '/api/v1/inspections/123';

      filter.catch(new Error('test'), mockHost);

      const body = getResponseBody();
      expect(body.path).toBe('/api/v1/inspections/123');
    });

    it('should set timestamp close to current time', () => {
      const before = new Date().toISOString();

      filter.catch(new Error('test'), mockHost);

      const after = new Date().toISOString();
      const body = getResponseBody();

      expect(body.timestamp >= before).toBe(true);
      expect(body.timestamp <= after).toBe(true);
    });
  });
});
