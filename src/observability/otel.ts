import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  Sampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import { getOtelConfig, getOtelResourceAttributes } from './otel.config';

let otelSdk: NodeSDK | undefined;

export function setupOpenTelemetry(): void {
  const config = getOtelConfig();
  if (!config.enabled || !config.tracesEndpoint) {
    return;
  }

  if (otelSdk) {
    return;
  }

  if ((process.env.OTEL_DIAGNOSTIC_LOGS || '').toLowerCase() === 'true') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
  }

  const traceExporter = new OTLPTraceExporter({
    url: config.tracesEndpoint,
  });

  const sampler = buildSampler(config.sampler, config.samplingRatio);
  const spanProcessor = new BatchSpanProcessor(traceExporter);
  const resource = new Resource(getOtelResourceAttributes(config));

  otelSdk = new NodeSDK({
    resource,
    sampler,
    spanProcessor,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (request) =>
            request.url?.includes('/api/v1/metrics') || false,
        },
      }),
    ],
  });

  otelSdk.start();
}

export async function shutdownOpenTelemetry(): Promise<void> {
  if (!otelSdk) {
    return;
  }

  const sdk = otelSdk;
  otelSdk = undefined;
  await sdk.shutdown();
}

function buildSampler(samplerName: string, ratio: number): Sampler {
  if (samplerName !== 'parentbased_traceidratio') {
    return new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(1),
    });
  }

  return new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(ratio),
  });
}
