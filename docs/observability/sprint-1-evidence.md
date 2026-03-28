# Sprint 1 Evidence (Backend)

This document records baseline evidence for Sprint 1 observability implementation in `cardano-backend`.

## Scope

- telemetry contract and RED normalization
- request ID propagation and error response correlation
- `/metrics` endpoint hardening (network/proxy + app-layer guard model)

Related PRs:

- `#136` (Sprint 1 telemetry baseline)
- `#137` (`/metrics` hardening)

## Evidence 1: `/metrics` output sample

Sample excerpt from generated metrics output:

```text
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{service="cardano-backend",env="development",method="GET",route="/api/v1/inspections/:id",status_class="2xx"} 1

# HELP http_request_duration_seconds Duration of HTTP requests in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.25",service="cardano-backend",env="development",method="GET",route="/api/v1/inspections/:id"} 1
http_request_duration_seconds_sum{service="cardano-backend",env="development",method="GET",route="/api/v1/inspections/:id"} 0.123
http_request_duration_seconds_count{service="cardano-backend",env="development",method="GET",route="/api/v1/inspections/:id"} 1

# HELP http_request_errors_total Total number of HTTP request errors
# TYPE http_request_errors_total counter
http_request_errors_total{service="cardano-backend",env="development",method="GET",route="/api/v1/inspections/:id",error_type="client_error"} 1
```

Validation points:

- route labels are normalized (`:id` template)
- low-cardinality labels (`service`, `env`, `method`, `route`, `status_class`, `error_type`)

## Evidence 2: Request ID presence in logs

Representative log lines from exception-filter test run:

```text
[INS-001 | /api/v1/test | requestId=req-1] Inspection not found
[USR-002 | /api/v1/test | requestId=req-1] Email already registered
[INS-003 | /api/v1/test | requestId=req-1] Invalid date format
[GEN-003 | /api/v1/test | requestId=req-1] Resource not found
[GEN-006 | /api/v1/test | requestId=req-1] field1 must be a string; field2 is required
[AUTH-001 | /api/v1/test | requestId=req-1] Unauthorized
[GEN-004 | /api/v1/test | requestId=req-1] Forbidden
[GEN-005 | /api/v1/test | requestId=req-1] Duplicate entry
[GEN-007 | /api/v1/test | requestId=req-1] ThrottlerException: Too Many Requests
[GEN-006 | /api/v1/test | requestId=req-1] Single error message
```

Validation points:

- request-level correlation ID is present in log context
- standardized error logging path includes request ID when available

## Evidence 3: Build and test baseline

Commands executed:

```bash
npm test -- src/common/request-id.middleware.spec.ts src/common/services/app-logger.service.spec.ts src/metrics/metrics.service.spec.ts src/metrics/metrics.middleware.spec.ts src/metrics/metrics-auth.guard.spec.ts src/metrics/metrics.controller.spec.ts
npm run build
```

Result summary:

- tests: `6` suites passed, `79` tests passed
- build: success (`nest build`)

## Sprint 1 completion status

- telemetry contract: completed
- RED metrics normalization: completed
- correlation ID middleware and propagation: completed
- `/metrics` hardening: completed

Sprint 1 backend umbrella can be considered complete for implementation scope.
