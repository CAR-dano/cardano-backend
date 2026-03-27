import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_REGEX = /^[0-9a-f]{16,}$/i;

type RequestWithRoute = Request & {
  baseUrl?: string;
  route?: { path?: string | string[] };
};

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = process.hrtime.bigint();

    this.metricsService.incrementActiveConnections();

    res.on('finish', () => {
      const elapsedNs = process.hrtime.bigint() - startTime;
      const duration = Number(elapsedNs) / 1_000_000_000;
      const route = this.resolveRouteTemplate(req as RequestWithRoute);
      const method = req.method;
      const statusClass = this.getStatusClass(res.statusCode);

      this.metricsService.incrementHttpRequests(method, route, statusClass);
      this.metricsService.observeHttpDuration(method, route, duration);

      if (res.statusCode >= 400) {
        const errorType =
          res.statusCode >= 500 ? 'server_error' : 'client_error';
        this.metricsService.incrementHttpErrors(method, route, errorType);
      }

      this.metricsService.decrementActiveConnections();
    });

    next();
  }

  private getStatusClass(statusCode: number): string {
    return `${Math.floor(statusCode / 100)}xx`;
  }

  private resolveRouteTemplate(req: RequestWithRoute): string {
    if (req.route?.path) {
      const routePath = Array.isArray(req.route.path)
        ? req.route.path[0]
        : req.route.path;

      return this.normalizeRoute(`${req.baseUrl || ''}${routePath || ''}`);
    }

    const path = req.originalUrl?.split('?')[0] || req.path || '/unknown';
    return this.normalizeRoute(path);
  }

  private normalizeRoute(path: string): string {
    const segments = path
      .split('/')
      .filter(Boolean)
      .map((segment) => {
        if (segment.startsWith(':')) {
          return segment;
        }

        if (segment.length > 0 && /^\d+$/.test(segment)) {
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

    return `/${segments.join('/') || ''}`;
  }
}
