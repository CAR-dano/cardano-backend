/*
 * --------------------------------------------------------------------------
 * File: logger.config.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Logger configuration for the application.
 * Provides flexible logging configuration based on environment variables.
 * --------------------------------------------------------------------------
 */

import { LogLevel } from '@nestjs/common';

export interface LoggerConfig {
  logLevels: LogLevel[];
  enableTimestamp: boolean;
  enableColors: boolean;
}

/**
 * Get logger configuration based on environment variables
 */
export function getLoggerConfig(): LoggerConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const logLevel = process.env.LOG_LEVEL || 'info';

  let logLevels: LogLevel[];

  // Configure log levels based on LOG_LEVEL environment variable
  switch (logLevel.toLowerCase()) {
    case 'error':
      logLevels = ['error'];
      break;
    case 'warn':
      logLevels = ['error', 'warn'];
      break;
    case 'info':
      logLevels = ['error', 'warn', 'log'];
      break;
    case 'debug':
      logLevels = ['error', 'warn', 'log', 'debug'];
      break;
    case 'verbose':
      logLevels = ['error', 'warn', 'log', 'debug', 'verbose'];
      break;
    default:
      // Default configuration based on environment
      if (nodeEnv === 'production') {
        logLevels = ['error', 'warn'];
      } else if (nodeEnv === 'test') {
        logLevels = ['error'];
      } else {
        logLevels = ['error', 'warn', 'log', 'debug'];
      }
  }

  return {
    logLevels,
    enableTimestamp: process.env.LOG_TIMESTAMP !== 'false',
    enableColors:
      process.env.LOG_COLORS !== 'false' && nodeEnv !== 'production',
  };
}

/**
 * Available log levels for easy reference
 */
export const LOG_LEVELS = {
  ERROR: 'error' as const,
  WARN: 'warn' as const,
  INFO: 'info' as const,
  DEBUG: 'debug' as const,
  VERBOSE: 'verbose' as const,
};
