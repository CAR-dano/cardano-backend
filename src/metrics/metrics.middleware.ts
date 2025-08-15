import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();

    // Count active connections
    this.metricsService.setActiveConnections(1);

    res.on('finish', () => {
      const duration = (Date.now() - startTime) / 1000;
      const route = String(req.path);
      const method = req.method;
      const status = res.statusCode.toString();

      // Record HTTP metrics
      this.metricsService.incrementHttpRequests(method, route, status);
      this.metricsService.observeHttpDuration(method, route, status, duration);

      // Reset active connections (simplified)
      this.metricsService.setActiveConnections(0);
    });

    next();
  }
}
