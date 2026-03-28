import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { MetricsAuthGuard } from './metrics-auth.guard';

function buildExecutionContext(
  authorization?: string,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          authorization,
        },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('MetricsAuthGuard', () => {
  const originalEnv = process.env;
  let guard: MetricsAuthGuard;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.METRICS_BEARER_TOKEN;
    delete process.env.METRICS_BASIC_AUTH_USER;
    delete process.env.METRICS_BASIC_AUTH_PASSWORD;
    delete process.env.NODE_ENV;
    delete process.env.METRICS_ENABLED;

    guard = new MetricsAuthGuard();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('allows access in non-production when no auth is configured', () => {
    process.env.NODE_ENV = 'development';

    expect(guard.canActivate(buildExecutionContext())).toBe(true);
  });

  it('denies access in production when no auth is configured', () => {
    process.env.NODE_ENV = 'production';

    expect(guard.canActivate(buildExecutionContext())).toBe(false);
  });

  it('throws 404 when metrics are explicitly disabled', () => {
    process.env.METRICS_ENABLED = 'false';

    expect(() => guard.canActivate(buildExecutionContext())).toThrow(
      NotFoundException,
    );
  });

  it('allows valid bearer token', () => {
    process.env.METRICS_BEARER_TOKEN = 'secret-token';

    expect(
      guard.canActivate(buildExecutionContext('Bearer secret-token')),
    ).toBe(true);
  });

  it('denies invalid bearer token', () => {
    process.env.METRICS_BEARER_TOKEN = 'secret-token';

    expect(
      guard.canActivate(buildExecutionContext('Bearer invalid-token')),
    ).toBe(false);
  });

  it('accepts lowercase bearer scheme', () => {
    process.env.METRICS_BEARER_TOKEN = 'secret-token';

    expect(
      guard.canActivate(buildExecutionContext('bearer secret-token')),
    ).toBe(true);
  });

  it('allows valid basic auth credentials', () => {
    process.env.METRICS_BASIC_AUTH_USER = 'metrics';
    process.env.METRICS_BASIC_AUTH_PASSWORD = 'strong-password';

    const encoded = Buffer.from('metrics:strong-password').toString('base64');
    expect(guard.canActivate(buildExecutionContext(`Basic ${encoded}`))).toBe(
      true,
    );
  });

  it('denies invalid basic auth credentials', () => {
    process.env.METRICS_BASIC_AUTH_USER = 'metrics';
    process.env.METRICS_BASIC_AUTH_PASSWORD = 'strong-password';

    const encoded = Buffer.from('metrics:wrong-password').toString('base64');
    expect(guard.canActivate(buildExecutionContext(`Basic ${encoded}`))).toBe(
      false,
    );
  });

  it('accepts lowercase basic scheme', () => {
    process.env.METRICS_BASIC_AUTH_USER = 'metrics';
    process.env.METRICS_BASIC_AUTH_PASSWORD = 'strong-password';

    const encoded = Buffer.from('metrics:strong-password').toString('base64');
    expect(guard.canActivate(buildExecutionContext(`basic ${encoded}`))).toBe(
      true,
    );
  });
});
