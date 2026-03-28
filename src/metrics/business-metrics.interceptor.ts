import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

interface TransferData {
  amount?: number;
}

interface SyncData {
  syncPercentage?: number;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_REGEX = /^[0-9a-f]{16,}$/i;

@Injectable()
export class BusinessMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<{ url?: string }>();
    const endpoint = String(request.url || '');

    return next.handle().pipe(
      tap((data) => {
        // Track successful operations based on endpoint
        this.trackBusinessMetrics(endpoint, 'success', data);
      }),
      catchError((error: Error) => {
        // Track failed operations
        this.trackBusinessMetrics(endpoint, 'failure', null);
        const normalizedRoute = this.normalizeRoute(endpoint);
        this.metricsService.incrementError(
          error.name || 'UnknownError',
          normalizedRoute,
        );
        throw error;
      }),
    );
  }

  private normalizeRoute(url: string): string {
    const path = url.split('?')[0] || '/unknown';

    const segments = path
      .split('/')
      .filter(Boolean)
      .map((segment) => {
        if (segment.startsWith(':')) {
          return segment;
        }

        if (/^\d+$/.test(segment)) {
          return ':id';
        }

        if (UUID_REGEX.test(segment)) {
          return ':uuid';
        }

        if (HEX_REGEX.test(segment)) {
          return ':hash';
        }

        return segment;
      });

    return `/${segments.join('/')}`;
  }

  private trackBusinessMetrics(endpoint: string, status: string, data: any) {
    // Wallet operations tracking
    if (endpoint.includes('/wallet')) {
      if (endpoint.includes('create')) {
        this.metricsService.incrementWalletOperation('create', status);
      } else if (endpoint.includes('transfer')) {
        this.metricsService.incrementWalletOperation('transfer', status);

        // Track ADA volume if transfer is successful
        if (status === 'success' && data && (data as TransferData).amount) {
          this.metricsService.setAdaTransferVolume(
            (data as TransferData).amount as number,
          );
        }
      } else if (endpoint.includes('balance')) {
        this.metricsService.incrementWalletOperation('balance_check', status);
      }
    }

    // Blockchain operations tracking
    if (endpoint.includes('/blockchain')) {
      if (endpoint.includes('sync')) {
        this.metricsService.incrementWalletOperation('sync', status);

        // Update sync status if available
        if (status === 'success' && data && (data as SyncData).syncPercentage) {
          this.metricsService.setBlockchainSyncStatus(
            (data as SyncData).syncPercentage as number,
          );
        }
      }
    }

    // Authentication operations
    if (endpoint.includes('/auth')) {
      if (endpoint.includes('login')) {
        this.metricsService.incrementWalletOperation('auth_login', status);
      } else if (endpoint.includes('register')) {
        this.metricsService.incrementWalletOperation('auth_register', status);
      }
    }

    // Inspection operations (for your specific business)
    if (endpoint.includes('/inspection')) {
      if (endpoint.includes('create')) {
        this.metricsService.incrementWalletOperation(
          'inspection_create',
          status,
        );
      } else if (endpoint.includes('update')) {
        this.metricsService.incrementWalletOperation(
          'inspection_update',
          status,
        );
      }
    }
  }
}
