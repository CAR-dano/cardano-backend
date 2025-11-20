import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge, register } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly httpRequestsTotal: Counter<string>;
  private readonly httpRequestDuration: Histogram<string>;
  private readonly activeConnections: Gauge<string>;
  private readonly databaseConnections: Gauge<string>;
  private readonly walletOperations: Counter<string>;
  private readonly adaTransferVolume: Gauge<string>;
  private readonly blockchainSyncStatus: Gauge<string>;
  private readonly errorCount: Counter<string>;
  private readonly photoUploadDuration: Histogram<string>;
  private readonly photoUploadTotal: Counter<string>;
  private readonly photoDeleteTotal: Counter<string>;

  constructor() {
    // HTTP Metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
    });

    this.activeConnections = new Gauge({
      name: 'active_connections',
      help: 'Number of active connections',
    });

    // Database Metrics
    this.databaseConnections = new Gauge({
      name: 'database_connections_active',
      help: 'Number of active database connections',
    });

    // Business Metrics
    this.walletOperations = new Counter({
      name: 'wallet_operations_total',
      help: 'Total wallet operations',
      labelNames: ['operation_type', 'status'],
    });

    this.adaTransferVolume = new Gauge({
      name: 'ada_transfer_volume_lovelace',
      help: 'ADA transfer volume in lovelace',
    });

    this.blockchainSyncStatus = new Gauge({
      name: 'blockchain_sync_percentage',
      help: 'Blockchain synchronization percentage',
    });

    // Error Metrics
    this.errorCount = new Counter({
      name: 'application_errors_total',
      help: 'Total application errors',
      labelNames: ['error_type', 'endpoint'],
    });

    // Photo Storage Metrics
    this.photoUploadDuration = new Histogram({
      name: 'photo_upload_duration_ms',
      help: 'Duration of inspection photo uploads in milliseconds',
      labelNames: ['provider', 'status'],
      buckets: [50, 100, 200, 500, 1000, 2000, 5000, 10000],
    });

    this.photoUploadTotal = new Counter({
      name: 'photo_upload_total',
      help: 'Total number of inspection photo uploads',
      labelNames: ['provider', 'status'],
    });

    this.photoDeleteTotal = new Counter({
      name: 'photo_delete_total',
      help: 'Total number of inspection photo deletions',
      labelNames: ['provider', 'status'],
    });

    // Register all metrics
    register.registerMetric(this.httpRequestsTotal);
    register.registerMetric(this.httpRequestDuration);
    register.registerMetric(this.activeConnections);
    register.registerMetric(this.databaseConnections);
    register.registerMetric(this.walletOperations);
    register.registerMetric(this.adaTransferVolume);
    register.registerMetric(this.blockchainSyncStatus);
    register.registerMetric(this.errorCount);
    register.registerMetric(this.photoUploadDuration);
    register.registerMetric(this.photoUploadTotal);
    register.registerMetric(this.photoDeleteTotal);
  }

  // HTTP Metrics Methods
  incrementHttpRequests(method: string, route: string, status: string) {
    this.httpRequestsTotal.inc({ method, route, status });
  }

  observeHttpDuration(
    method: string,
    route: string,
    status: string,
    duration: number,
  ) {
    this.httpRequestDuration.observe({ method, route, status }, duration);
  }

  setActiveConnections(count: number) {
    this.activeConnections.set(count);
  }

  // Database Metrics Methods
  setDatabaseConnections(count: number) {
    this.databaseConnections.set(count);
  }

  // Business Metrics Methods
  incrementWalletOperation(operationType: string, status: string) {
    this.walletOperations.inc({ operation_type: operationType, status });
  }

  setAdaTransferVolume(volume: number) {
    this.adaTransferVolume.set(volume);
  }

  setBlockchainSyncStatus(percentage: number) {
    this.blockchainSyncStatus.set(percentage);
  }

  // Error Metrics Methods
  incrementError(errorType: string, endpoint: string) {
    this.errorCount.inc({ error_type: errorType, endpoint });
  }

  recordPhotoUpload(provider: string, success: boolean, durationMs: number) {
    const status = success ? 'success' : 'failure';
    this.photoUploadTotal.inc({ provider, status });
    this.photoUploadDuration.observe({ provider, status }, durationMs);
  }

  recordPhotoDelete(provider: string, success: boolean) {
    const status = success ? 'success' : 'failure';
    this.photoDeleteTotal.inc({ provider, status });
  }

  // Get all metrics
  async getMetrics(): Promise<string> {
    return await register.metrics();
  }
}
