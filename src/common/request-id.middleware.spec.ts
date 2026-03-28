import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import { RequestIdMiddleware } from './request-id.middleware';
import { RequestContext } from './request-context';

jest.mock('crypto', () => ({
  randomUUID: jest.fn(),
}));

describe('RequestIdMiddleware', () => {
  const middleware = new RequestIdMiddleware();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reuse incoming x-request-id header', () => {
    const req: any = {
      headers: { 'x-request-id': 'incoming-id' },
      header: jest.fn((name: string) => req.headers[name]),
    };
    const res: any = new EventEmitter();
    res.setHeader = jest.fn();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.headers['x-request-id']).toBe('incoming-id');
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'incoming-id');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should generate x-request-id when header is missing', () => {
    (randomUUID as jest.Mock).mockReturnValue('generated-id');

    const req: any = {
      headers: {},
      header: jest.fn(() => undefined),
    };
    const res: any = new EventEmitter();
    res.setHeader = jest.fn();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.headers['x-request-id']).toBe('generated-id');
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'generated-id');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should expose requestId in async request context', () => {
    const req: any = {
      headers: { 'x-request-id': 'ctx-id' },
      header: jest.fn((name: string) => req.headers[name]),
    };
    const res: any = new EventEmitter();
    res.setHeader = jest.fn();

    let capturedRequestId: string | undefined;
    middleware.use(req, res, () => {
      capturedRequestId = RequestContext.getRequestId();
    });

    expect(capturedRequestId).toBe('ctx-id');
  });
});
