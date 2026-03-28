/*
 * --------------------------------------------------------------------------
 * File: all-exceptions.filter.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Global exception filter that catches ALL exceptions and
 * returns a standardized error response format. Handles three categories:
 *   1. AppError      — custom domain errors with typed error codes
 *   2. HttpException  — NestJS built-in HTTP exceptions (including validation)
 *   3. Unknown errors — unexpected/unhandled errors (logged as critical)
 *
 * Response format matches HttpErrorResponseDto for Swagger documentation.
 * --------------------------------------------------------------------------
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes.enum';

/**
 * Standardized error response interface.
 * Matches the HttpErrorResponseDto shape for Swagger documentation.
 */
export interface StandardErrorResponse {
  statusCode: number;
  message: string[];
  error: string;
  errorCode: string;
  path: string;
  timestamp: string;
  requestId?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.buildErrorResponse(exception, request);

    // Log based on severity
    this.logException(exception, errorResponse);

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  /**
   * Build a standardized error response from any exception type.
   */
  private buildErrorResponse(
    exception: unknown,
    request: Request,
  ): StandardErrorResponse {
    const timestamp = new Date().toISOString();
    const path = request.url;
    const requestIdHeader = request.headers['x-request-id'];
    const requestId =
      typeof requestIdHeader === 'string'
        ? requestIdHeader
        : Array.isArray(requestIdHeader)
          ? requestIdHeader[0]
          : undefined;

    // ── 1. AppError (custom domain errors) ─────────────────────────
    if (exception instanceof AppError) {
      return {
        statusCode: exception.statusCode,
        message: [exception.message],
        error: this.getErrorLabel(exception.statusCode),
        errorCode: exception.code,
        path,
        timestamp,
        requestId,
      };
    }

    // ── 2. HttpException (NestJS built-in) ─────────────────────────
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // NestJS ValidationPipe returns { message: string[], error: string, statusCode: number }
      const messages = this.extractMessages(exceptionResponse);
      const errorLabel =
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'error' in exceptionResponse
          ? (exceptionResponse as any).error
          : this.getErrorLabel(status);

      return {
        statusCode: status,
        message: messages,
        error: errorLabel,
        errorCode: this.mapHttpStatusToErrorCode(status),
        path,
        timestamp,
        requestId,
      };
    }

    // ── 3. Unknown / unhandled errors ──────────────────────────────
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: ['An unexpected error occurred'],
      error: 'Internal Server Error',
      errorCode: ErrorCode.INTERNAL_ERROR,
      path,
      timestamp,
      requestId,
    };
  }

  /**
   * Extract message array from various exception response shapes.
   */
  private extractMessages(exceptionResponse: string | object): string[] {
    if (typeof exceptionResponse === 'string') {
      return [exceptionResponse];
    }

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const resp = exceptionResponse as any;

      // ValidationPipe format: { message: string[] | string }
      if (resp.message) {
        return Array.isArray(resp.message) ? resp.message : [resp.message];
      }
    }

    return ['An error occurred'];
  }

  /**
   * Map HTTP status codes to generic ErrorCode values.
   */
  private mapHttpStatusToErrorCode(status: number): string {
    const statusMap: Record<number, ErrorCode> = {
      [HttpStatus.BAD_REQUEST]: ErrorCode.BAD_REQUEST,
      [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
      [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
      [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
      [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
      [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.TOO_MANY_REQUESTS,
      [HttpStatus.UNPROCESSABLE_ENTITY]: ErrorCode.VALIDATION_ERROR,
    };

    return statusMap[status] || ErrorCode.INTERNAL_ERROR;
  }

  /**
   * Get a human-readable error label from HTTP status code.
   */
  private getErrorLabel(status: number): string {
    const labelMap: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'Bad Request',
      [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
      [HttpStatus.FORBIDDEN]: 'Forbidden',
      [HttpStatus.NOT_FOUND]: 'Not Found',
      [HttpStatus.CONFLICT]: 'Conflict',
      [HttpStatus.GONE]: 'Gone',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
      [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
      [HttpStatus.BAD_GATEWAY]: 'Bad Gateway',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
      [HttpStatus.GATEWAY_TIMEOUT]: 'Gateway Timeout',
    };

    return labelMap[status] || 'Error';
  }

  /**
   * Log the exception with appropriate severity level.
   */
  private logException(
    exception: unknown,
    errorResponse: StandardErrorResponse,
  ): void {
    const { statusCode, errorCode, path, message } = errorResponse;
    const requestInfo = errorResponse.requestId
      ? ` | requestId=${errorResponse.requestId}`
      : '';
    const logContext = `${errorCode} | ${path}${requestInfo}`;

    if (statusCode >= 500) {
      // Server errors — log with stack trace
      const stack =
        exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`[${logContext}] ${message.join('; ')}`, stack);
    } else if (statusCode >= 400) {
      // Client errors — warn level, no stack
      this.logger.warn(`[${logContext}] ${message.join('; ')}`);
    }
  }
}
