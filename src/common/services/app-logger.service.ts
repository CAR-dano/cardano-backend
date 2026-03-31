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

type LogLevelName = 'log' | 'error' | 'warn' | 'debug' | 'verbose';

@Injectable({ scope: Scope.TRANSIENT })
export class AppLoggerService extends Logger implements LoggerService {
  private enabledLevels!: Set<string>;
  private serviceName!: string;
  private environment!: string;
  private useJsonFormat!: boolean;
  private includeStack!: boolean;

  constructor(private configService: ConfigService) {
    super();
    this.initializeConfig();
  }

  private initializeConfig() {
    const logLevel = this.configService.get<string>('LOG_LEVEL', 'info');
    this.serviceName =
      this.configService.get<string>('OBS_SERVICE_NAME') || 'cardano-backend';
    this.environment =
      this.configService.get<string>('OBS_ENV') ||
      this.configService.get<string>('NODE_ENV', 'development');
    this.useJsonFormat =
      (
        this.configService.get<string>('LOG_FORMAT', 'json') || 'json'
      ).toLowerCase() === 'json';
    this.includeStack =
      (this.configService.get<string>('LOG_INCLUDE_STACK') ||
        (this.environment === 'production' ? 'false' : 'true')) === 'true';

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
      super.log(this.formatLog('log', message, context || this.context));
    }
  }

  /**
   * Log error level message
   */
  error(message: any, trace?: string, context?: string) {
    if (this.enabledLevels.has('error')) {
      super.error(
        this.formatLog('error', message, context || this.context, {
          ...(trace && this.includeStack ? { stack: trace } : {}),
        }),
      );
    }
  }

  /**
   * Log warning level message
   */
  warn(message: any, context?: string) {
    if (this.enabledLevels.has('warn')) {
      super.warn(this.formatLog('warn', message, context || this.context));
    }
  }

  /**
   * Log debug level message
   */
  debug(message: any, context?: string) {
    if (this.enabledLevels.has('debug')) {
      super.debug(this.formatLog('debug', message, context || this.context));
    }
  }

  /**
   * Log verbose level message
   */
  verbose(message: any, context?: string) {
    if (this.enabledLevels.has('verbose')) {
      super.verbose(
        this.formatLog('verbose', message, context || this.context),
      );
    }
  }

  private buildCorrelationContext(): Record<string, string> {
    const requestId = RequestContext.getRequestId();
    const spanContext = trace.getActiveSpan()?.spanContext();

    return {
      ...(requestId ? { requestId } : {}),
      ...(spanContext?.traceId ? { traceId: spanContext.traceId } : {}),
      ...(spanContext?.spanId ? { spanId: spanContext.spanId } : {}),
    };
  }

  private formatLog(
    level: LogLevelName,
    message: any,
    context?: string,
    metadata?: Record<string, unknown>,
  ): string {
    const correlation = this.buildCorrelationContext();
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      env: this.environment,
      ...(context ? { context } : {}),
      message: this.serializeMessage(message),
      ...correlation,
      ...(metadata || {}),
    } as Record<string, unknown>;

    if (message instanceof Error && this.includeStack && message.stack) {
      payload.stack = message.stack;
    }

    if (!this.useJsonFormat) {
      return String(payload.message);
    }

    return JSON.stringify(payload);
  }

  private serializeMessage(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }

    if (message instanceof Error) {
      return message.message;
    }

    if (typeof message === 'object' && message !== null) {
      try {
        return JSON.stringify(message);
      } catch {
        return '[unserializable-object]';
      }
    }

    return String(message);
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

    const formatted = this.formatLog(
      level,
      message,
      context || this.context,
      metadata,
    );

    if (level === 'error') {
      super.error(formatted);
      return;
    }

    if (level === 'warn') {
      super.warn(formatted);
      return;
    }

    if (level === 'debug') {
      super.debug(formatted);
      return;
    }

    if (level === 'verbose') {
      super.verbose(formatted);
      return;
    }

    super.log(formatted);
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
    const level = statusCode >= 400 ? 'warn' : 'log';
    const logMessage = this.formatLog(
      level,
      'http_request',
      context || 'HTTP',
      {
        method,
        route: url,
        statusCode,
        durationMs: responseTime,
      },
    );

    if (statusCode >= 400) {
      super.warn(logMessage);
    } else {
      super.log(logMessage);
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
    if (!this.enabledLevels.has('debug')) {
      return;
    }

    super.debug(
      this.formatLog('debug', 'database_operation', context || 'Database', {
        operation,
        table,
        durationMs: duration,
      }),
    );
  }

  /**
   * Check if a log level is enabled
   */
  isLevelEnabled(level: string): boolean {
    return this.enabledLevels.has(level);
  }
}
