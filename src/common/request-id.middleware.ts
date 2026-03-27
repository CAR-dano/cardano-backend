import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { RequestContext } from './request-context';

const REQUEST_ID_HEADER = 'x-request-id';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incomingRequestId = req.header(REQUEST_ID_HEADER);
    const requestId =
      typeof incomingRequestId === 'string' && incomingRequestId.trim().length > 0
        ? incomingRequestId.trim()
        : randomUUID();

    req.headers[REQUEST_ID_HEADER] = requestId;
    res.setHeader('X-Request-ID', requestId);

    RequestContext.run({ requestId }, () => next());
  }
}
