import {
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

export interface OTelConfig {
  enabled: boolean;
  serviceName: string;
  environment: string;
  serviceVersion: string;
  tracesEndpoint?: string;
  sampler: string;
  samplingRatio: number;
}

const TRACE_EXPORT_PATH = '/v1/traces';
const DEFAULT_SAMPLER = 'parentbased_traceidratio';

const DEFAULT_SAMPLING_RATIO_BY_ENV: Record<string, number> = {
  development: 1,
  test: 1,
  staging: 0.2,
  production: 0.1,
};

export function getOtelConfig(): OTelConfig {
  const enabled =
    (process.env.OTEL_ENABLED || 'false').trim().toLowerCase() === 'true';

  const serviceName =
    process.env.OBS_SERVICE_NAME ||
    process.env.OTEL_SERVICE_NAME ||
    'cardano-backend';

  const environment =
    process.env.OBS_ENV || process.env.NODE_ENV || 'development';

  const serviceVersion =
    process.env.OTEL_SERVICE_VERSION ||
    process.env.npm_package_version ||
    '0.0.1';

  const explicitTracesEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  const baseOtlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const tracesEndpoint = explicitTracesEndpoint
    ? normalizeTracesEndpoint(explicitTracesEndpoint, false)
    : normalizeTracesEndpoint(baseOtlpEndpoint, true);

  const sampler =
    process.env.OTEL_TRACES_SAMPLER?.trim().toLowerCase() || DEFAULT_SAMPLER;
  const samplingRatio = resolveSamplingRatio(environment);

  return {
    enabled,
    serviceName,
    environment,
    serviceVersion,
    tracesEndpoint,
    sampler,
    samplingRatio,
  };
}

export function getOtelResourceAttributes(
  config: OTelConfig,
): Record<string, string> {
  return {
    [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: config.environment,
    [SEMRESATTRS_SERVICE_VERSION]: config.serviceVersion,
  };
}

export function normalizeTracesEndpoint(
  endpoint?: string,
  appendDefaultPath = true,
): string | undefined {
  if (!endpoint) {
    return undefined;
  }

  const trimmed = endpoint.trim();
  if (!trimmed) {
    return undefined;
  }

  if (!appendDefaultPath || trimmed.endsWith(TRACE_EXPORT_PATH)) {
    return trimmed;
  }

  return `${trimmed.replace(/\/$/, '')}${TRACE_EXPORT_PATH}`;
}

function resolveSamplingRatio(environment: string): number {
  const explicitRatio = parseRatio(process.env.OTEL_TRACES_SAMPLER_ARG);
  if (explicitRatio !== undefined) {
    return explicitRatio;
  }

  const envSpecificKey = getEnvSpecificSamplerArgKey(environment);
  const envSpecificRatio = parseRatio(process.env[envSpecificKey]);
  if (envSpecificRatio !== undefined) {
    return envSpecificRatio;
  }

  return DEFAULT_SAMPLING_RATIO_BY_ENV[environment] ?? 1;
}

function getEnvSpecificSamplerArgKey(environment: string): string {
  switch (environment) {
    case 'production':
      return 'OTEL_TRACES_SAMPLER_ARG_PRODUCTION';
    case 'staging':
      return 'OTEL_TRACES_SAMPLER_ARG_STAGING';
    case 'test':
      return 'OTEL_TRACES_SAMPLER_ARG_TEST';
    case 'development':
    default:
      return 'OTEL_TRACES_SAMPLER_ARG_DEVELOPMENT';
  }
}

function parseRatio(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return undefined;
  }

  return parsed;
}
