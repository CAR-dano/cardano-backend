/*
 * --------------------------------------------------------------------------
 * File: app-error.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Custom application error class that extends the native Error.
 * Provides a typed error code, HTTP status code, and optional details
 * for consistent error handling throughout the application.
 * --------------------------------------------------------------------------
 */

import { ErrorCode } from './error-codes.enum';

/**
 * Base application error with structured error code, HTTP status, and details.
 *
 * @example
 * throw new AppError(
 *   'Inspection not found',
 *   ErrorCode.INSPECTION_NOT_FOUND,
 *   404,
 * );
 *
 * @example
 * throw new AppError(
 *   'Failed to hash password',
 *   ErrorCode.USER_PASSWORD_HASH_FAILED,
 *   500,
 *   { originalError: error.message },
 * );
 */
export class AppError extends Error {
  /**
   * @param message - Human-readable error description
   * @param code - Typed error code from ErrorCode enum
   * @param statusCode - HTTP status code (default 500)
   * @param details - Optional additional context (will be omitted in production)
   */
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, any>,
  ) {
    super(message);
    this.name = 'AppError';

    // Maintains proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
