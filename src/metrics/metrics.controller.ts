import {
  Controller,
  Get,
  Header,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { MetricsService } from './metrics.service';
import { MetricsAuthGuard } from './metrics-auth.guard';

@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain')
  @Header('Cache-Control', 'no-store')
  // Restrict to 10 scrapes/min — Prometheus scrapes every 15s at most, so this is generous
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(MetricsAuthGuard)
  @ApiOperation({ summary: 'Get Prometheus metrics' })
  @ApiResponse({
    status: 200,
    description: 'Prometheus metrics in text format',
  })
  @ApiResponse({
    status: 404,
    description: 'Metrics endpoint disabled',
  })
  async getMetrics(): Promise<string> {
    return await this.metricsService.getMetrics();
  }
}
