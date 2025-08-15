# Monitoring Setup dengan Prometheus & Grafana

## Overview

Sistem monitoring ini menggunakan Prometheus untuk collection metrics dan Grafana untuk visualization. Setup ini sudah terintegrasi dengan Docker Compose untuk memudahkan deployment.

## Komponen Monitoring

### 1. **Prometheus** (Port: 9090)

- Mengumpulkan metrics dari aplikasi NestJS
- Menyimpan historical data
- Menjalankan alerting rules

### 2. **Grafana** (Port: 3001)

- Dashboard untuk visualisasi metrics
- Default credentials: `admin` / `admin123`

### 3. **Node Exporter** (Port: 9100)

- System metrics (CPU, Memory, Disk, Network)

### 4. **PostgreSQL Exporter** (Port: 9187)

- Database performance metrics

## Metrics yang Dikumpulkan

### HTTP Metrics

- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request duration histogram
- `active_connections` - Active connections gauge

### Business Metrics

- `wallet_operations_total` - Wallet operations counter
- `ada_transfer_volume_lovelace` - ADA transfer volume
- `blockchain_sync_percentage` - Blockchain sync status

### System Metrics

- `process_cpu_seconds_total` - CPU usage
- `process_resident_memory_bytes` - Memory usage
- `database_connections_active` - Database connections

### Error Metrics

- `application_errors_total` - Application errors counter

## Quick Start

### 1. Jalankan dengan Docker Compose

```bash
# Start semua services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f grafana
docker-compose logs -f prometheus
```

### 2. Akses Dashboard

- **Grafana**: http://localhost:3001

  - Username: `admin`
  - Password: `admin123`

- **Prometheus**: http://localhost:9090

- **Application Metrics**: http://localhost:3010/metrics

### 3. Import Dashboard

Dashboard sudah otomatis ter-provision, tetapi jika perlu manual import:

1. Login ke Grafana
2. Go to `+` → `Import`
3. Upload file dari `monitoring/grafana/dashboards/`

## Dashboard yang Tersedia

### 1. **Cardano Backend Dashboard**

- HTTP Request metrics
- Response time percentiles
- CPU & Memory usage
- Error rates

### 2. **Cardano Business Metrics**

- Wallet operations
- ADA transfer volume
- Blockchain sync status
- Business-specific KPIs

## Alerting

Alerts dikonfigurasi di `monitoring/prometheus/alerts.yml`:

- **HighErrorRate**: Error rate > 10% selama 5 menit
- **HighResponseTime**: 95th percentile > 1 detik selama 2 menit
- **HighMemoryUsage**: Memory > 512MB selama 5 menit
- **ServiceDown**: Service down selama 1 menit

## Customization

### Menambah Metrics Baru

1. **Tambah ke MetricsService**:

```typescript
private readonly customMetric: Counter<string>;

constructor() {
  this.customMetric = new Counter({
    name: 'custom_metric_total',
    help: 'Description of custom metric',
    labelNames: ['label1', 'label2'],
  });
}
```

2. **Gunakan di Business Logic**:

```typescript
this.metricsService.incrementCustomMetric('label1_value', 'label2_value');
```

### Menambah Dashboard Panel

1. Edit file JSON di `monitoring/grafana/dashboards/`
2. Atau buat via Grafana UI dan export

### Menambah Alert Rule

1. Edit `monitoring/prometheus/alerts.yml`
2. Restart Prometheus: `docker-compose restart prometheus`

## Monitoring Best Practices

### 1. **Metrics Naming**

- Gunakan format: `[namespace]_[subsystem]_[metric_name]_[unit]`
- Contoh: `cardano_wallet_operations_total`

### 2. **Labels**

- Gunakan labels untuk dimensi yang berbeda
- Hindari high cardinality labels
- Maksimal 10 label values per metric

### 3. **Dashboard Design**

- Group related metrics
- Gunakan consistent time ranges
- Tambahkan descriptions untuk context

### 4. **Alert Management**

- Set meaningful thresholds
- Avoid alert fatigue
- Include runbook links

## Troubleshooting

### Prometheus tidak scrape metrics

```bash
# Check prometheus targets
curl http://localhost:9090/targets

# Check application metrics endpoint
curl http://localhost:3010/metrics
```

### Grafana tidak bisa connect ke Prometheus

```bash
# Check docker network
docker network ls
docker network inspect new-cardano-backend_cardano-backend

# Check prometheus dari dalam container
docker exec -it grafana curl http://prometheus:9090/api/v1/status/config
```

### Metrics tidak muncul

1. Pastikan MetricsMiddleware ter-apply ke semua routes
2. Check format metrics di `/metrics` endpoint
3. Verify Prometheus scrape configuration

## Production Considerations

### 1. **Security**

- Gunakan authentication untuk Grafana
- Restrict Prometheus access
- Use HTTPS in production

### 2. **Storage**

- Configure retention policies
- Monitor disk usage
- Setup backup for Grafana dashboards

### 3. **Performance**

- Monitor metric cardinality
- Optimize scrape intervals
- Use recording rules untuk complex queries

### 4. **High Availability**

- Setup Prometheus federation
- Use Grafana HA setup
- Configure persistent volumes

## Useful Queries

### HTTP Traffic

```promql
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# Response time percentiles
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

### Business Metrics

```promql
# Daily wallet operations
increase(wallet_operations_total[24h])

# ADA transfer rate
rate(wallet_operations_total{operation_type="transfer"}[5m])

# Blockchain sync lag
100 - blockchain_sync_percentage
```

### System Metrics

```promql
# CPU usage
rate(process_cpu_seconds_total[5m]) * 100

# Memory usage
process_resident_memory_bytes / 1024 / 1024

# Database connections
database_connections_active
```
