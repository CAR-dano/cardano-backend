import { Test } from '@nestjs/testing';
import { AppLoggerService } from './app-logger.service';
import { ConfigService } from '@nestjs/config';
import { trace } from '@opentelemetry/api';
import { RequestContext } from '../request-context';

function buildModule(logLevel: string, extras: Record<string, any> = {}) {
  const configMap: Record<string, any> = {
    LOG_LEVEL: logLevel,
    LOG_FORMAT: 'json',
    OBS_SERVICE_NAME: 'cardano-backend',
    OBS_ENV: 'staging',
    LOG_INCLUDE_STACK: 'true',
    ...extras,
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) =>
      key in configMap ? configMap[key] : defaultValue,
    ),
  };

  return Test.createTestingModule({
    providers: [
      AppLoggerService,
      { provide: ConfigService, useValue: mockConfigService },
    ],
  }).compile();
}

function parseJsonLog(payload: string): Record<string, any> {
  return JSON.parse(payload);
}

describe('AppLoggerService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should emit JSON log with baseline fields', async () => {
    const module = await buildModule('info');
    const logger = await module.resolve(AppLoggerService);
    const superLogSpy = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(logger)), 'log')
      .mockImplementation(() => {});

    logger.log('hello world', 'Bootstrap');

    const payload = parseJsonLog(superLogSpy.mock.calls[0][0] as string);
    expect(payload.level).toBe('log');
    expect(payload.message).toBe('hello world');
    expect(payload.service).toBe('cardano-backend');
    expect(payload.env).toBe('staging');
    expect(payload.context).toBe('Bootstrap');
    expect(payload.timestamp).toBeDefined();
  });

  it('should include requestId traceId spanId when available', async () => {
    const module = await buildModule('info');
    const logger = await module.resolve(AppLoggerService);
    const superLogSpy = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(logger)), 'log')
      .mockImplementation(() => {});

    jest.spyOn(trace, 'getActiveSpan').mockReturnValue({
      spanContext: () => ({
        traceId: '0123456789abcdef0123456789abcdef',
        spanId: '0123456789abcdef',
        traceFlags: 1,
      }),
    } as any);

    RequestContext.run({ requestId: 'req-123' }, () => {
      logger.log('correlated log');
    });

    const payload = parseJsonLog(superLogSpy.mock.calls[0][0] as string);
    expect(payload.requestId).toBe('req-123');
    expect(payload.traceId).toBe('0123456789abcdef0123456789abcdef');
    expect(payload.spanId).toBe('0123456789abcdef');
  });

  it('should include http request fields in structured payload', async () => {
    const module = await buildModule('info');
    const logger = await module.resolve(AppLoggerService);
    const superWarnSpy = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(logger)), 'warn')
      .mockImplementation(() => {});

    logger.logHttpRequest('GET', '/api/v1/inspections/:id', 500, 81, 'HTTP');

    const payload = parseJsonLog(superWarnSpy.mock.calls[0][0] as string);
    expect(payload.message).toBe('http_request');
    expect(payload.method).toBe('GET');
    expect(payload.route).toBe('/api/v1/inspections/:id');
    expect(payload.statusCode).toBe(500);
    expect(payload.durationMs).toBe(81);
    expect(payload.level).toBe('warn');
  });

  it('should include metadata via logWithMetadata', async () => {
    const module = await buildModule('info');
    const logger = await module.resolve(AppLoggerService);
    const superLogSpy = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(logger)), 'log')
      .mockImplementation(() => {});

    logger.logWithMetadata(
      'log',
      'meta_event',
      { foo: 'bar', count: 2 },
      'Meta',
    );

    const payload = parseJsonLog(superLogSpy.mock.calls[0][0] as string);
    expect(payload.message).toBe('meta_event');
    expect(payload.foo).toBe('bar');
    expect(payload.count).toBe(2);
    expect(payload.context).toBe('Meta');
  });

  it('should include stack only when LOG_INCLUDE_STACK=true', async () => {
    const module = await buildModule('error', { LOG_INCLUDE_STACK: 'true' });
    const logger = await module.resolve(AppLoggerService);
    const superErrorSpy = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(logger)), 'error')
      .mockImplementation(() => {});

    logger.error('failed', 'stack-value', 'ErrCtx');

    const payload = parseJsonLog(superErrorSpy.mock.calls[0][0] as string);
    expect(payload.stack).toBe('stack-value');
    expect(payload.context).toBe('ErrCtx');
  });

  it('should skip stack when LOG_INCLUDE_STACK=false', async () => {
    const module = await buildModule('error', { LOG_INCLUDE_STACK: 'false' });
    const logger = await module.resolve(AppLoggerService);
    const superErrorSpy = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(logger)), 'error')
      .mockImplementation(() => {});

    logger.error('failed', 'stack-value', 'ErrCtx');

    const payload = parseJsonLog(superErrorSpy.mock.calls[0][0] as string);
    expect(payload.stack).toBeUndefined();
  });
});
