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
      incrementActiveConnections: jest.fn(),
      decrementActiveConnections: jest.fn(),
      incrementHttpRequests: jest.fn(),
      observeHttpDuration: jest.fn(),
      incrementHttpErrors: jest.fn(),
    };
    middleware = new MetricsMiddleware(metricsService as MetricsService);
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should increment active connections immediately on request', () => {
    const req: any = { method: 'GET', path: '/api/test' };
    const res: any = new EventEmitter();
    res.statusCode = 200;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(metricsService.incrementActiveConnections).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should record HTTP metrics and decrement active connections', () => {
    const req: any = { method: 'POST', path: '/api/inspections' };
    const res: any = new EventEmitter();
    res.statusCode = 201;
    const next = jest.fn();

    middleware.use(req, res, next);
    res.emit('finish');

    expect(metricsService.incrementHttpRequests).toHaveBeenCalledWith(
      'POST',
      '/api/inspections',
      '2xx',
    );
    expect(metricsService.observeHttpDuration).toHaveBeenCalledWith(
      'POST',
      '/api/inspections',
      expect.any(Number),
    );
    expect(metricsService.decrementActiveConnections).toHaveBeenCalledTimes(1);
  });

  it('should normalize dynamic numeric routes to :id', () => {
    const req: any = { method: 'GET', path: '/api/v1/inspections/123' };
    const res: any = new EventEmitter();
    res.statusCode = 200;

    middleware.use(req, res, jest.fn());
    res.emit('finish');

    expect(metricsService.incrementHttpRequests).toHaveBeenCalledWith(
      'GET',
      '/api/v1/inspections/:id',
      '2xx',
    );
  });

  it('should increment HTTP error counter for client errors', () => {
    const req: any = { method: 'GET', path: '/api/v1/inspections/1' };
    const res: any = new EventEmitter();
    res.statusCode = 404;

    middleware.use(req, res, jest.fn());
    res.emit('finish');

    expect(metricsService.incrementHttpErrors).toHaveBeenCalledWith(
      'GET',
      '/api/v1/inspections/:id',
      'client_error',
    );
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

    const call = (metricsService.observeHttpDuration as jest.Mock).mock
      .calls[0];
    const duration = call[2];
    expect(duration).toBeGreaterThanOrEqual(0);
  });
});
