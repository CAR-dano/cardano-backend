/*
 * --------------------------------------------------------------------------
 * File: app-error.spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Unit tests for AppError class and ErrorCode enum.
 * --------------------------------------------------------------------------
 */

import { AppError } from './app-error';
import { ErrorCode } from './error-codes.enum';

describe('AppError', () => {
  it('should create an instance with required fields', () => {
    const error = new AppError(
      'Something went wrong',
      ErrorCode.INTERNAL_ERROR,
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Something went wrong');
    expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(error.statusCode).toBe(500); // default
    expect(error.details).toBeUndefined();
    expect(error.name).toBe('AppError');
  });

  it('should set custom statusCode', () => {
    const error = new AppError('Not found', ErrorCode.USER_NOT_FOUND, 404);

    expect(error.statusCode).toBe(404);
  });

  it('should set details when provided', () => {
    const details = { field: 'email', value: 'test@test.com' };
    const error = new AppError(
      'Conflict',
      ErrorCode.USER_EMAIL_CONFLICT,
      409,
      details,
    );

    expect(error.details).toEqual(details);
  });

  it('should pass instanceof check after Object.setPrototypeOf', () => {
    const error = new AppError('test', ErrorCode.INTERNAL_ERROR);
    expect(error instanceof AppError).toBe(true);
  });

  it('should have a stack trace', () => {
    const error = new AppError('test', ErrorCode.INTERNAL_ERROR);
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('AppError');
  });

  it('should preserve readonly properties', () => {
    const error = new AppError('test', ErrorCode.INSPECTION_NOT_FOUND, 404, {
      reason: 'deleted',
    });

    // TypeScript readonly enforces this at compile time,
    // but we verify the values are correct at runtime
    expect(error.code).toBe(ErrorCode.INSPECTION_NOT_FOUND);
    expect(error.statusCode).toBe(404);
    expect(error.details).toEqual({ reason: 'deleted' });
  });
});

describe('ErrorCode', () => {
  it('should have General error codes', () => {
    expect(ErrorCode.VALIDATION_ERROR).toBe('GEN-001');
    expect(ErrorCode.INTERNAL_ERROR).toBe('GEN-002');
    expect(ErrorCode.NOT_FOUND).toBe('GEN-003');
    expect(ErrorCode.FORBIDDEN).toBe('GEN-004');
    expect(ErrorCode.CONFLICT).toBe('GEN-005');
    expect(ErrorCode.BAD_REQUEST).toBe('GEN-006');
    expect(ErrorCode.TOO_MANY_REQUESTS).toBe('GEN-007');
  });

  it('should have Auth error codes', () => {
    expect(ErrorCode.UNAUTHORIZED).toBe('AUTH-001');
    expect(ErrorCode.INVALID_CREDENTIALS).toBe('AUTH-002');
    expect(ErrorCode.TOKEN_EXPIRED).toBe('AUTH-003');
    expect(ErrorCode.TOKEN_BLACKLISTED).toBe('AUTH-004');
    expect(ErrorCode.REFRESH_TOKEN_INVALID).toBe('AUTH-005');
  });

  it('should have User error codes', () => {
    expect(ErrorCode.USER_NOT_FOUND).toBe('USR-001');
    expect(ErrorCode.USER_EMAIL_CONFLICT).toBe('USR-002');
    expect(ErrorCode.USER_USERNAME_CONFLICT).toBe('USR-003');
    expect(ErrorCode.USER_WALLET_CONFLICT).toBe('USR-004');
  });

  it('should have Inspection error codes', () => {
    expect(ErrorCode.INSPECTION_NOT_FOUND).toBe('INS-001');
    expect(ErrorCode.INSPECTION_ALREADY_APPROVED).toBe('INS-002');
    expect(ErrorCode.INSPECTION_INVALID_DATE).toBe('INS-003');
  });

  it('should have Blockchain error codes', () => {
    expect(ErrorCode.BLOCKCHAIN_TX_HASH_REQUIRED).toBe('BLK-001');
    expect(ErrorCode.BLOCKCHAIN_MINTING_FAILED).toBe('BLK-006');
    expect(ErrorCode.WALLET_SIGNATURE_INVALID).toBe('BLK-009');
  });

  it('should have Database error codes', () => {
    expect(ErrorCode.DATABASE_ERROR).toBe('DB-001');
    expect(ErrorCode.DATABASE_QUERY_TIMEOUT).toBe('DB-002');
    expect(ErrorCode.DATABASE_CONNECTION_FAILED).toBe('DB-003');
  });

  it('should have all error codes as unique values', () => {
    const values = Object.values(ErrorCode);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it('should have all error codes follow domain-number pattern', () => {
    const values = Object.values(ErrorCode);
    const pattern = /^[A-Z]+-\d{3}$/;
    values.forEach((code) => {
      expect(code).toMatch(pattern);
    });
  });
});
