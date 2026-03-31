# Sprint 2 Evidence (Backend)

This document records Sprint 2 observability evidence for `cardano-backend`.

## Scope

- OpenTelemetry SDK bootstrap and lifecycle
- HTTP and DB span instrumentation
- Trace-log correlation
- Structured JSON logging schema
- Sampling policy by environment

Related PRs:

- `#139` OTel SDK bootstrap
- `#140` HTTP and DB spans
- `#141` trace-log correlation
- `#142` sampling policy by environment
- `#143` structured JSON logging

## Evidence 1: Structured JSON log samples

Representative application log payload (from logger schema tests):

```json
{
  "timestamp": "2026-03-31T12:26:56.089Z",
  "level": "log",
  "service": "cardano-backend",
  "env": "staging",
  "context": "Bootstrap",
  "message": "hello world",
  "requestId": "req-123",
  "traceId": "0123456789abcdef0123456789abcdef",
  "spanId": "0123456789abcdef"
}
```

Representative HTTP request log payload:

```json
{
  "timestamp": "2026-03-31T12:30:58.089Z",
  "level": "warn",
  "service": "cardano-backend",
  "env": "staging",
  "context": "HTTP",
  "message": "http_request",
  "method": "GET",
  "route": "/api/v1/inspections/:id",
  "statusCode": 500,
  "durationMs": 81,
  "requestId": "req-123",
  "traceId": "0123456789abcdef0123456789abcdef",
  "spanId": "0123456789abcdef"
}
```

Validation points:

- baseline JSON fields are present (`timestamp`, `level`, `service`, `env`, `message`)
- request and trace correlation fields are available when context exists
- HTTP logs include method/route/status/duration for Loki queries

## Evidence 2: Sampling policy configuration

Configured defaults:

- `development`: `1.0`
- `test`: `1.0`
- `staging`: `0.2`
- `production`: `0.1`

Override precedence:

1. `OTEL_TRACES_SAMPLER_ARG` (global)
2. `OTEL_TRACES_SAMPLER_ARG_<ENV>` (env-specific)
3. environment defaults

Validation points:

- config unit tests verify defaults, override precedence, and invalid fallback handling

## Evidence 3: Build and test baseline

Commands executed:

```bash
npm run lint
npm test -- src/observability/otel.config.spec.ts src/prisma/prisma.service.spec.ts src/common/services/app-logger.service.spec.ts src/common/filters/all-exceptions.filter.spec.ts
npm run build
```

Result summary:

- lint: success
- tests: success
- build: success (`nest build`)

## Evidence 4: Staging trace verification checklist

The following should be captured from staging deployment and attached to issue comments:

- Jaeger screenshot: `cardano-backend` trace list
- Jaeger screenshot: endpoint trace with child DB span
- Prometheus query screenshot for RED + error metrics
- Loki query screenshot filtering by `traceId` and `requestId`

## Sprint 2 completion status

- OTel bootstrap: completed
- HTTP/DB instrumentation: completed
- trace-log correlation: completed
- structured JSON logging: completed
- sampling policy: completed
