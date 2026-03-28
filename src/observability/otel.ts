import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
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

export async function setupOpenTelemetry(): Promise<void> {
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

  const sampler = buildSampler();
  const spanProcessor = new BatchSpanProcessor(traceExporter);
  const resource = new Resource(getOtelResourceAttributes(config));

  otelSdk = new NodeSDK({
    resource,
    sampler,
    spanProcessor,
  });

  await otelSdk.start();
}

export async function shutdownOpenTelemetry(): Promise<void> {
  if (!otelSdk) {
    return;
  }

  const sdk = otelSdk;
  otelSdk = undefined;
  await sdk.shutdown();
}

function buildSampler(): Sampler {
  const ratioRaw = process.env.OTEL_TRACES_SAMPLER_ARG || '1';
  const ratio = Number(ratioRaw);

  if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) {
    return new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(1),
    });
  }

  return new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(ratio),
  });
}
