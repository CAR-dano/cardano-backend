/*
 * --------------------------------------------------------------------------
 * File: business-metrics.interceptor.spec.ts
 * --------------------------------------------------------------------------
 */
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { BusinessMetricsInterceptor } from './business-metrics.interceptor';
import { MetricsService } from './metrics.service';

function buildContext(url: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ url }),
    }),
  } as unknown as ExecutionContext;
}

function buildHandler(data: any): CallHandler {
  return { handle: () => of(data) };
}

function buildErrorHandler(error: Error): CallHandler {
  return { handle: () => throwError(() => error) };
}

describe('BusinessMetricsInterceptor', () => {
  let interceptor: BusinessMetricsInterceptor;
  let metricsService: jest.Mocked<Partial<MetricsService>>;

  beforeEach(() => {
    metricsService = {
      incrementWalletOperation: jest.fn(),
      setAdaTransferVolume: jest.fn(),
      setBlockchainSyncStatus: jest.fn(),
      incrementError: jest.fn(),
    };
    interceptor = new BusinessMetricsInterceptor(
      metricsService as MetricsService,
    );
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should call incrementWalletOperation("create", "success") for /wallet/create endpoint', (done) => {
    const ctx = buildContext('/wallet/create');
    interceptor.intercept(ctx, buildHandler({})).subscribe({
      complete: () => {
        expect(metricsService.incrementWalletOperation).toHaveBeenCalledWith(
          'create',
          'success',
        );
        done();
      },
    });
  });

  it('should call incrementWalletOperation("transfer", "success") for /wallet/transfer', (done) => {
    const ctx = buildContext('/wallet/transfer');
    const data = { amount: 1000000 };
    interceptor.intercept(ctx, buildHandler(data)).subscribe({
      complete: () => {
        expect(metricsService.incrementWalletOperation).toHaveBeenCalledWith(
          'transfer',
          'success',
        );
        expect(metricsService.setAdaTransferVolume).toHaveBeenCalledWith(
          1000000,
        );
        done();
      },
    });
  });

  it('should call incrementWalletOperation("transfer", "success") but NOT setAdaTransferVolume when no amount', (done) => {
    const ctx = buildContext('/wallet/transfer');
    interceptor.intercept(ctx, buildHandler({})).subscribe({
      complete: () => {
        expect(metricsService.incrementWalletOperation).toHaveBeenCalledWith(
          'transfer',
          'success',
        );
        expect(metricsService.setAdaTransferVolume).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('should call incrementWalletOperation("balance_check", "success") for /wallet/balance', (done) => {
    const ctx = buildContext('/wallet/balance');
    interceptor.intercept(ctx, buildHandler({})).subscribe({
      complete: () => {
        expect(metricsService.incrementWalletOperation).toHaveBeenCalledWith(
          'balance_check',
          'success',
        );
        done();
      },
    });
  });

  it('should call incrementWalletOperation("sync", "success") and setBlockchainSyncStatus for /blockchain/sync', (done) => {
    const ctx = buildContext('/blockchain/sync');
    const data = { syncPercentage: 98.5 };
    interceptor.intercept(ctx, buildHandler(data)).subscribe({
      complete: () => {
        expect(metricsService.incrementWalletOperation).toHaveBeenCalledWith(
          'sync',
          'success',
        );
        expect(metricsService.setBlockchainSyncStatus).toHaveBeenCalledWith(
          98.5,
        );
        done();
      },
    });
  });

  it('should call incrementWalletOperation("auth_login", "success") for /auth/login', (done) => {
    const ctx = buildContext('/auth/login');
    interceptor.intercept(ctx, buildHandler({})).subscribe({
      complete: () => {
        expect(metricsService.incrementWalletOperation).toHaveBeenCalledWith(
          'auth_login',
          'success',
        );
        done();
      },
    });
  });

  it('should call incrementWalletOperation("auth_register", "success") for /auth/register', (done) => {
    const ctx = buildContext('/auth/register');
    interceptor.intercept(ctx, buildHandler({})).subscribe({
      complete: () => {
        expect(metricsService.incrementWalletOperation).toHaveBeenCalledWith(
          'auth_register',
          'success',
        );
        done();
      },
    });
  });

  it('should call incrementWalletOperation("inspection_create", "success") for /inspection/create', (done) => {
    const ctx = buildContext('/inspection/create');
    interceptor.intercept(ctx, buildHandler({})).subscribe({
      complete: () => {
        expect(metricsService.incrementWalletOperation).toHaveBeenCalledWith(
          'inspection_create',
          'success',
        );
        done();
      },
    });
  });

  it('should call incrementWalletOperation("inspection_update", "success") for /inspection/update', (done) => {
    const ctx = buildContext('/inspection/update');
    interceptor.intercept(ctx, buildHandler({})).subscribe({
      complete: () => {
        expect(metricsService.incrementWalletOperation).toHaveBeenCalledWith(
          'inspection_update',
          'success',
        );
        done();
      },
    });
  });

  it('should track failure and call incrementError on error', (done) => {
    const ctx = buildContext('/auth/login');
    const error = new Error('AuthFailed');
    error.name = 'AuthError';
    interceptor.intercept(ctx, buildErrorHandler(error)).subscribe({
      error: (e) => {
        expect(metricsService.incrementWalletOperation).toHaveBeenCalledWith(
          'auth_login',
          'failure',
        );
        expect(metricsService.incrementError).toHaveBeenCalledWith(
          'AuthError',
          '/auth/login',
        );
        expect(e).toBe(error);
        done();
      },
    });
  });

  it('should use "UnknownError" when error.name is missing', (done) => {
    const ctx = buildContext('/wallet/create');
    const error = new Error('boom');
    Object.defineProperty(error, 'name', { value: undefined, writable: true });
    interceptor.intercept(ctx, buildErrorHandler(error)).subscribe({
      error: () => {
        expect(metricsService.incrementError).toHaveBeenCalledWith(
          'UnknownError',
          '/wallet/create',
        );
        done();
      },
    });
  });

  it('should normalize dynamic route when tracking errors', (done) => {
    const ctx = buildContext('/inspections/123?include=details');
    const error = new Error('broken');
    error.name = 'BadRequestError';

    interceptor.intercept(ctx, buildErrorHandler(error)).subscribe({
      error: () => {
        expect(metricsService.incrementError).toHaveBeenCalledWith(
          'BadRequestError',
          '/inspections/:id',
        );
        done();
      },
    });
  });

  it('should not call any metrics for untracked endpoints', (done) => {
    const ctx = buildContext('/health');
    interceptor.intercept(ctx, buildHandler({})).subscribe({
      complete: () => {
        expect(metricsService.incrementWalletOperation).not.toHaveBeenCalled();
        done();
      },
    });
  });
});
