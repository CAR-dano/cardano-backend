import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { id?: string }, res: Response, next: NextFunction) {
    const headerId = (req.headers['x-request-id'] as string) || undefined;
    const id = headerId || randomUUID();
    req.id = id;
    res.setHeader('x-request-id', id);
    next();
  }
}
