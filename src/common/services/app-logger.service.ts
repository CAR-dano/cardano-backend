/*
 * --------------------------------------------------------------------------
 * File: app-logger.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Custom logger service for enhanced logging capabilities.
 * Provides structured logging with context, correlation IDs, and filtering.
 * --------------------------------------------------------------------------
 */

import { Injectable, Logger, LoggerService, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { trace } from '@opentelemetry/api';
import { RequestContext } from '../request-context';

@Injectable({ scope: Scope.TRANSIENT })
export class AppLoggerService extends Logger implements LoggerService {
  private enabledLevels!: Set<string>;
  private enableTimestamp!: boolean;
  private enableColors!: boolean;

  constructor(private configService: ConfigService) {
    super();
    this.initializeConfig();
  }

  private initializeConfig() {
    const logLevel = this.configService.get<string>('LOG_LEVEL', 'info');
    this.enableTimestamp = this.configService.get<boolean>(
      'LOG_TIMESTAMP',
      true,
    );
    this.enableColors = this.configService.get<boolean>('LOG_COLORS', true);

    // Set enabled levels based on configuration
    this.enabledLevels = new Set();

    switch (logLevel.toLowerCase()) {
      case 'verbose':
        this.enabledLevels.add('verbose');
        this.enabledLevels.add('debug');
        this.enabledLevels.add('log');
        this.enabledLevels.add('warn');
        this.enabledLevels.add('error');
        break;
      case 'debug':
        this.enabledLevels.add('debug');
        this.enabledLevels.add('log');
        this.enabledLevels.add('warn');
        this.enabledLevels.add('error');
        break;
      case 'info':
        this.enabledLevels.add('log');
        this.enabledLevels.add('warn');
        this.enabledLevels.add('error');
        break;
      case 'warn':
        this.enabledLevels.add('warn');
        this.enabledLevels.add('error');
        break;
      case 'error':
        this.enabledLevels.add('error');
        break;
      default:
        this.enabledLevels.add('error');
        this.enabledLevels.add('warn');
        this.enabledLevels.add('log');
    }
  }

  /**
   * Set context for the logger
   */
  setContext(context: string) {
    this.context = context;
  }

  /**
   * Log info level message
   */
  log(message: any, context?: string) {
    if (this.enabledLevels.has('log')) {
      super.log(this.withRequestId(message), context || this.context);
    }
  }

  /**
   * Log error level message
   */
  error(message: any, trace?: string, context?: string) {
    if (this.enabledLevels.has('error')) {
      super.error(this.withRequestId(message), trace, context || this.context);
    }
  }

  /**
   * Log warning level message
   */
  warn(message: any, context?: string) {
    if (this.enabledLevels.has('warn')) {
      super.warn(this.withRequestId(message), context || this.context);
    }
  }

  /**
   * Log debug level message
   */
  debug(message: any, context?: string) {
    if (this.enabledLevels.has('debug')) {
      super.debug(this.withRequestId(message), context || this.context);
    }
  }

  /**
   * Log verbose level message
   */
  verbose(message: any, context?: string) {
    if (this.enabledLevels.has('verbose')) {
      super.verbose(this.withRequestId(message), context || this.context);
    }
  }

  private withRequestId(message: any): any {
    const requestId = RequestContext.getRequestId();
    const spanContext = trace.getActiveSpan()?.spanContext();

    const correlationParts: string[] = [];
    if (requestId) {
      correlationParts.push(`requestId=${requestId}`);
    }
    if (spanContext?.traceId) {
      correlationParts.push(`traceId=${spanContext.traceId}`);
    }
    if (spanContext?.spanId) {
      correlationParts.push(`spanId=${spanContext.spanId}`);
    }

    if (correlationParts.length === 0) {
      return message;
    }

    if (typeof message === 'string') {
      return `[${correlationParts.join(' ')}] ${message}`;
    }

    if (message && typeof message === 'object') {
      return {
        ...(requestId ? { requestId } : {}),
        ...(spanContext?.traceId ? { traceId: spanContext.traceId } : {}),
        ...(spanContext?.spanId ? { spanId: spanContext.spanId } : {}),
        ...message,
      };
    }

    return `[${correlationParts.join(' ')}] ${String(message)}`;
  }

  /**
   * Structured logging with additional metadata
   */
  logWithMetadata(
    level: 'log' | 'error' | 'warn' | 'debug' | 'verbose',
    message: string,
    metadata?: Record<string, any>,
    context?: string,
  ) {
    if (!this.enabledLevels.has(level)) {
      return;
    }

    const logMessage = metadata
      ? `${message} ${JSON.stringify(metadata)}`
      : message;

    this[level](logMessage, context || this.context);
  }

  /**
   * Log HTTP request information
   */
  logHttpRequest(
    method: string,
    url: string,
    statusCode: number,
    responseTime: number,
    context?: string,
  ) {
    const message = `${method} ${url} ${statusCode} - ${responseTime}ms`;

    if (statusCode >= 400) {
      this.warn(message, context || 'HTTP');
    } else {
      this.log(message, context || 'HTTP');
    }
  }

  /**
   * Log database operations
   */
  logDatabaseOperation(
    operation: string,
    table: string,
    duration: number,
    context?: string,
  ) {
    this.debug(
      `DB ${operation} on ${table} - ${duration}ms`,
      context || 'Database',
    );
  }

  /**
   * Check if a log level is enabled
   */
  isLevelEnabled(level: string): boolean {
    return this.enabledLevels.has(level);
  }
}
