import {
  getOtelConfig,
  getOtelResourceAttributes,
  normalizeTracesEndpoint,
} from './otel.config';

describe('OTel config helpers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OTEL_ENABLED;
    delete process.env.OBS_SERVICE_NAME;
    delete process.env.OTEL_SERVICE_NAME;
    delete process.env.OBS_ENV;
    delete process.env.NODE_ENV;
    delete process.env.OTEL_SERVICE_VERSION;
    delete process.env.npm_package_version;
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns sensible defaults when env is not set', () => {
    const config = getOtelConfig();

    expect(config.enabled).toBe(false);
    expect(config.serviceName).toBe('cardano-backend');
    expect(config.environment).toBe('development');
    expect(config.serviceVersion).toBe('0.0.1');
  });

  it('builds traces endpoint from OTLP base endpoint', () => {
    process.env.OTEL_ENABLED = 'true';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT =
      'http://otel-collector:4318';

    const config = getOtelConfig();
    expect(config.tracesEndpoint).toBe('http://otel-collector:4318/v1/traces');
  });

  it('prefers explicit OTLP traces endpoint over base endpoint', () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT =
      'http://otel-collector:4318';
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT =
      'http://otel-collector:4318/custom/traces';

    const config = getOtelConfig();
    expect(config.tracesEndpoint).toBe('http://otel-collector:4318/custom/traces');
  });

  it('maps semantic resource attributes correctly', () => {
    process.env.OTEL_ENABLED = 'true';
    process.env.OBS_SERVICE_NAME = 'backend-api';
    process.env.OBS_ENV = 'staging';
    process.env.OTEL_SERVICE_VERSION = '2.3.4';

    const config = getOtelConfig();
    const attrs = getOtelResourceAttributes(config);

    expect(attrs['service.name']).toBe('backend-api');
    expect(attrs['deployment.environment']).toBe('staging');
    expect(attrs['service.version']).toBe('2.3.4');
  });

  it('keeps traces endpoint unchanged when already on /v1/traces', () => {
    expect(
      normalizeTracesEndpoint('http://localhost:4318/v1/traces', true),
    ).toBe(
      'http://localhost:4318/v1/traces',
    );
  });

  it('returns explicit endpoint unchanged when default append is disabled', () => {
    expect(normalizeTracesEndpoint('http://localhost:4318/custom', false)).toBe(
      'http://localhost:4318/custom',
    );
  });
});
