/*
 * --------------------------------------------------------------------------
 * File: metrics.middleware.spec.ts
 * --------------------------------------------------------------------------
 */
import { MetricsMiddleware } from './metrics.middleware';
import { MetricsService } from './metrics.service';
import { EventEmitter } from 'events';

describe('MetricsMiddleware', () => {
  let middleware: MetricsMiddleware;
  let metricsService: jest.Mocked<Partial<MetricsService>>;

  beforeEach(() => {
    metricsService = {
      setActiveConnections: jest.fn(),
      incrementHttpRequests: jest.fn(),
      observeHttpDuration: jest.fn(),
    };
    middleware = new MetricsMiddleware(metricsService as MetricsService);
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should call setActiveConnections(1) immediately on request', () => {
    const req: any = { method: 'GET', path: '/api/test' };
    const res: any = new EventEmitter();
    res.statusCode = 200;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(metricsService.setActiveConnections).toHaveBeenCalledWith(1);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should record HTTP metrics and reset connections on response finish', () => {
    const req: any = { method: 'POST', path: '/api/inspections' };
    const res: any = new EventEmitter();
    res.statusCode = 201;
    const next = jest.fn();

    middleware.use(req, res, next);
    res.emit('finish');

    expect(metricsService.incrementHttpRequests).toHaveBeenCalledWith(
      'POST',
      '/api/inspections',
      '201',
    );
    expect(metricsService.observeHttpDuration).toHaveBeenCalledWith(
      'POST',
      '/api/inspections',
      '201',
      expect.any(Number),
    );
    expect(metricsService.setActiveConnections).toHaveBeenCalledWith(0);
  });

  it('should call next() to pass to next middleware', () => {
    const req: any = { method: 'GET', path: '/health' };
    const res: any = new EventEmitter();
    res.statusCode = 200;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should record duration as a non-negative number', () => {
    const req: any = { method: 'GET', path: '/metrics' };
    const res: any = new EventEmitter();
    res.statusCode = 200;
    const next = jest.fn();

    middleware.use(req, res, next);
    res.emit('finish');

    const call = (metricsService.observeHttpDuration as jest.Mock).mock.calls[0];
    const duration = call[3];
    expect(duration).toBeGreaterThanOrEqual(0);
  });
});
