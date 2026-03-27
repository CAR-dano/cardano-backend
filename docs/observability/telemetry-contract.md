# Telemetry Contract v1

This document defines the observability contract for `cardano-backend` as a telemetry producer.

## Scope

- Applies to metrics emitted from `cardano-backend`.
- Applies to request-level logging and error response metadata.
- Defines trace/log/metric correlation primitives for Sprint 1 baseline.

## Environment and service identity

- `service`: `OBS_SERVICE_NAME` (default: `cardano-backend`)
- `env`: `OBS_ENV` (fallback: `NODE_ENV`, default: `development`)

## Metrics contract

### Required RED metrics

- `http_requests_total{service,env,method,route,status_class}`
- `http_request_duration_seconds_bucket{service,env,method,route}`
- `http_request_errors_total{service,env,method,route,error_type}`

### Additional application metrics (existing)

- `active_connections`
- `database_connections_active`
- `wallet_operations_total`
- `ada_transfer_volume_lovelace`
- `blockchain_sync_percentage`
- `application_errors_total{service,env,error_type,route}`

### Label policy

Allowed labels:

- `service`
- `env`
- `method`
- `route`
- `status_class`
- `error_type`
- `operation_type`
- `status`

Forbidden labels:

- `userId`, `email`, `walletAddress`, `txHash`, `requestId`
- raw query values
- UUID/hash identifiers as metric labels

### Route normalization rules

Route labels must use templates instead of raw identifiers.

Examples:

- `/api/v1/inspections/123` -> `/api/v1/inspections/:id`
- `/api/v1/inspections/7d9d2b1e-11e4-4b0f-9f8e-bf216fb0d8ad` -> `/api/v1/inspections/:uuid`
- `/api/v1/blockchain/9f0caa1b...` -> `/api/v1/blockchain/:hash`

### Error type conventions

- `client_error` for HTTP `4xx`
- `server_error` for HTTP `5xx`
- application error names for `application_errors_total` (for example `ValidationError`, `AuthError`)

## Request correlation contract

- Incoming header supported: `x-request-id`
- If missing/empty, server generates a UUID
- Response echoes request ID in: `X-Request-ID`
- Request ID is propagated in async request context and included by `AppLoggerService`
- Error responses include `requestId` field when available

## Logging baseline

Sprint 1 baseline guarantees:

- request ID propagation support in middleware and app logger
- consistent inclusion of `requestId` in standardized error responses

Sprint 2 extends to full structured JSON logging with `traceId` and `spanId` correlation.

## Metrics endpoint

- Endpoint: `GET /api/v1/metrics`
- Content type: `text/plain`
- Intended scraper: Prometheus
- Recommended scrape config:
  - interval: `15s`
  - timeout: `5s`
- Access control: enforce at reverse proxy/network layer (internal allowlist/basic auth)

## Validation checklist

- No forbidden labels used in RED metrics
- Route labels are normalized templates
- Error counter increments for `4xx` and `5xx`
- Response includes `X-Request-ID`
