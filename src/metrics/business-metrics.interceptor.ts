import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

interface RequestWithUrl {
  url?: string;
}

interface TransferData {
  amount?: number;
}

interface SyncData {
  syncPercentage?: number;
}

@Injectable()
export class BusinessMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest() as RequestWithUrl;
    const endpoint = String(request.url || '');

    return next.handle().pipe(
      tap((data) => {
        // Track successful operations based on endpoint
        this.trackBusinessMetrics(endpoint, 'success', data);
      }),
      catchError((error: Error) => {
        // Track failed operations
        this.trackBusinessMetrics(endpoint, 'failure', null);
        this.metricsService.incrementError(
          error.name || 'UnknownError',
          endpoint,
        );
        throw error;
      }),
    );
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
