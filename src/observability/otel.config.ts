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
}

const TRACE_EXPORT_PATH = '/v1/traces';

export function getOtelConfig(): OTelConfig {
  const enabled =
    (process.env.OTEL_ENABLED || 'false').trim().toLowerCase() === 'true';

  const serviceName =
    process.env.OBS_SERVICE_NAME || process.env.OTEL_SERVICE_NAME || 'cardano-backend';

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

  return {
    enabled,
    serviceName,
    environment,
    serviceVersion,
    tracesEndpoint,
  };
}

export function getOtelResourceAttributes(config: OTelConfig): Record<string, string> {
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
