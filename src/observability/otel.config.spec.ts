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
    delete process.env.OTEL_TRACES_SAMPLER;
    delete process.env.OTEL_TRACES_SAMPLER_ARG;
    delete process.env.OTEL_TRACES_SAMPLER_ARG_DEVELOPMENT;
    delete process.env.OTEL_TRACES_SAMPLER_ARG_TEST;
    delete process.env.OTEL_TRACES_SAMPLER_ARG_STAGING;
    delete process.env.OTEL_TRACES_SAMPLER_ARG_PRODUCTION;
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
    expect(config.sampler).toBe('parentbased_traceidratio');
    expect(config.samplingRatio).toBe(1);
  });

  it('uses staging default sampling ratio when no explicit sampler arg', () => {
    process.env.OBS_ENV = 'staging';

    const config = getOtelConfig();
    expect(config.samplingRatio).toBe(0.2);
  });

  it('uses production default sampling ratio when no explicit sampler arg', () => {
    process.env.OBS_ENV = 'production';

    const config = getOtelConfig();
    expect(config.samplingRatio).toBe(0.1);
  });

  it('uses explicit global sampler arg when valid', () => {
    process.env.OTEL_TRACES_SAMPLER_ARG = '0.33';

    const config = getOtelConfig();
    expect(config.samplingRatio).toBe(0.33);
  });

  it('uses env-specific sampler arg when global is missing', () => {
    process.env.OBS_ENV = 'staging';
    process.env.OTEL_TRACES_SAMPLER_ARG_STAGING = '0.44';

    const config = getOtelConfig();
    expect(config.samplingRatio).toBe(0.44);
  });

  it('falls back to default ratio when explicit sampler arg is invalid', () => {
    process.env.OBS_ENV = 'production';
    process.env.OTEL_TRACES_SAMPLER_ARG = 'not-a-number';

    const config = getOtelConfig();
    expect(config.samplingRatio).toBe(0.1);
  });

  it('builds traces endpoint from OTLP base endpoint', () => {
    process.env.OTEL_ENABLED = 'true';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://otel-collector:4318';

    const config = getOtelConfig();
    expect(config.tracesEndpoint).toBe('http://otel-collector:4318/v1/traces');
  });

  it('prefers explicit OTLP traces endpoint over base endpoint', () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://otel-collector:4318';
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT =
      'http://otel-collector:4318/custom/traces';

    const config = getOtelConfig();
    expect(config.tracesEndpoint).toBe(
      'http://otel-collector:4318/custom/traces',
    );
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
    ).toBe('http://localhost:4318/v1/traces');
  });

  it('returns explicit endpoint unchanged when default append is disabled', () => {
    expect(normalizeTracesEndpoint('http://localhost:4318/custom', false)).toBe(
      'http://localhost:4318/custom',
    );
  });
});
