import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { ApiStandardErrors } from '../common/decorators/api-standard-errors.decorator';
import { MetricsService } from './metrics.service';

@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain')
  @ApiOperation({ summary: 'Get Prometheus metrics' })
  @ApiOkResponse({ description: 'Prometheus metrics in text format' })
  @ApiStandardErrors({ unauthorized: false, forbidden: false })
  async getMetrics(): Promise<string> {
    return await this.metricsService.getMetrics();
  }
}
